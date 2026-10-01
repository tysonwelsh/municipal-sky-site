/* jd-regress faketime — an LD_PRELOAD shim for the dev PHP server ONLY.
 *
 * The capture harness (capture.js) starts `php -S` with this library
 * preloaded so the server-side half of a capture is deterministic:
 *
 *   · the wall clock is FROZEN at JD_REGRESS_EPOCH (unix seconds): time(),
 *     gettimeofday() and clock_gettime(CLOCK_REALTIME*) all answer that
 *     instant, so jd_now(), gmdate('c'), the ULID time field, the visitor
 *     hash's date and every "per day" window in jd-analytics.php are the
 *     same on every run and every calendar day. Monotonic clocks are left
 *     alone (nothing in the app reads them into a payload).
 *   · the kernel CSPRNG is replaced by a fixed splitmix64 stream seeded from
 *     JD_REGRESS_SEED: getrandom(), getentropy() and syscall(SYS_getrandom)
 *     — the last is what PHP 8's random_bytes()/random_int() use on Linux —
 *     so jd_ulid()'s random half, and therefore every id minted during a
 *     capture, repeats run to run as long as requests arrive in the same
 *     order (capture.js serialises the ones that matter).
 *
 * Never load this into anything but the throwaway dev server: it makes
 * "random" bytes predictable by design.
 *
 * Build (capture.js does this itself, cached by source hash):
 *   cc -shared -fPIC -O2 -o jd-faketime.so faketime.c -ldl
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/time.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

static time_t fake_epoch = 0;
static int ready = 0;
static uint64_t rng_state = 0;

static void init(void)
{
    if (ready) return;
    const char *e = getenv("JD_REGRESS_EPOCH");
    const char *s = getenv("JD_REGRESS_SEED");
    fake_epoch = e ? (time_t) strtoll(e, NULL, 10) : (time_t) 1790856000;
    rng_state = s ? (uint64_t) strtoull(s, NULL, 10) : (uint64_t) 20261001;
    ready = 1;
}

static uint64_t splitmix64(void)
{
    uint64_t z = (rng_state += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

static void fill(void *buf, size_t len)
{
    unsigned char *p = (unsigned char *) buf;
    init();
    while (len) {
        uint64_t v = splitmix64();
        size_t n = len < 8 ? len : 8;
        memcpy(p, &v, n);
        p += n;
        len -= n;
    }
}

time_t time(time_t *t)
{
    init();
    if (t) *t = fake_epoch;
    return fake_epoch;
}

int gettimeofday(struct timeval *restrict tv, void *restrict tz)
{
    init();
    if (tv) { tv->tv_sec = fake_epoch; tv->tv_usec = 0; }
    if (tz) memset(tz, 0, sizeof(struct timezone));
    return 0;
}

int clock_gettime(clockid_t clk, struct timespec *ts)
{
    static int (*real)(clockid_t, struct timespec *) = NULL;
    init();
    if (clk == CLOCK_REALTIME || clk == CLOCK_REALTIME_COARSE) {
        if (ts) { ts->tv_sec = fake_epoch; ts->tv_nsec = 0; }
        return 0;
    }
    if (!real) real = (int (*)(clockid_t, struct timespec *)) dlsym(RTLD_NEXT, "clock_gettime");
    return real(clk, ts);
}

ssize_t getrandom(void *buf, size_t len, unsigned int flags)
{
    (void) flags;
    fill(buf, len);
    return (ssize_t) len;
}

int getentropy(void *buf, size_t len)
{
    if (len > 256) { errno = EIO; return -1; }
    fill(buf, len);
    return 0;
}

long syscall(long number, ...)
{
    static long (*real)(long, ...) = NULL;
    va_list ap;
    long a[6];
    int i;
    va_start(ap, number);
    for (i = 0; i < 6; i++) a[i] = va_arg(ap, long);
    va_end(ap);
    if (number == SYS_getrandom) {
        fill((void *) a[0], (size_t) a[1]);
        return a[1];
    }
    if (!real) real = (long (*)(long, ...)) dlsym(RTLD_NEXT, "syscall");
    return real(number, a[0], a[1], a[2], a[3], a[4], a[5]);
}
