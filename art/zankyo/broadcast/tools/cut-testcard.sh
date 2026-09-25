#!/usr/bin/env bash
# cut-testcard.sh — cut one clip for the ZANKYŌ test-card library.
#
# A test-card clip is ONE span (or up to three spans joined with hard cuts) of
# a test card, colour bars, a clock card or a station/stand-by card, taken from
# a raw source already on disk. It writes two files:
#
#   app clip     art/zankyo/broadcast/testcards/<id>.mp4
#                the reel picture/audio chain of make-reel.sh (192×144 grey,
#                12 fps, band-passed mono AAC ~32 kbps, two-pass loudnorm
#                I=-18 TP=-2), but contiguous — no windows. A silent stretch
#                gets a silent track and is NOT normalised (loudnorm would
#                pump tape hiss up to programme level).
#   master clip  <broadcast-src>/_testcards/<id>.mp4
#                the same span at the source's own resolution, in colour,
#                x264 crf 18, original audio as AAC 128k (stereo if the
#                source is stereo). Not published.
#
# Nothing reads the library yet; it is NOT part of the reel lottery, and this
# tool never touches reels/, manifest/ or manifest.json. See ../testcards/README.md.
set -euo pipefail
{ # parse-first wrapper (see make-reel.sh): a concurrent edit cannot derail a run

usage() {
  cat <<'EOF'
usage: cut-testcard.sh <source-file | reel-id> --id <tc-id> --span a-b[,c-d[,e-f]] [options]
       cut-testcard.sh --all            re-cut every entry of testcards/testcards.json

  <source>          a file path, or a reel/source id looked up as
                    local-dev/broadcast-src/<id>.<ext>
  --id <tc-id>      clip id, e.g. tc-kctv-pm5544-2003 (lowercase, digits, hyphens)
  --span a-b,…      source seconds (or m:ss / h:mm:ss). One span = one contiguous
                    clip; up to 3 spans are joined with hard cuts. Max 180 s total.
  --silent          ignore the source's audio: a silent app track, no loudnorm
                    (the master still keeps the original audio)
  --silent-below L  treat the span as silent when its integrated loudness is
                    below L LUFS (default -50: tape hiss only)
  --app-only | --master-only
  --max-kb N        app-clip size ceiling in KB (default 2048); the video crf is
                    raised in steps until the clip fits
  -h, --help
EOF
}
die() { echo "cut-testcard: $*" >&2; exit 1; }
log() { echo "▸ $*" >&2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$(cd "$HERE/.." && pwd)"                       # art/zankyo/broadcast
REPO="$(cd "$BC/../../.." && pwd)"
SRC_DIR="$REPO/local-dev/broadcast-src"
OUT_DIR="$BC/testcards"
MASTER_DIR="$(cd "$SRC_DIR" 2>/dev/null && pwd -P || echo "$SRC_DIR")/_testcards"
command -v ffmpeg >/dev/null || die "ffmpeg not found — brew install ffmpeg"

# ---- --all: replay the index --------------------------------------------------
if [ "${1:-}" = "--all" ]; then
  shift
  IDX="$OUT_DIR/testcards.json"; [ -s "$IDX" ] || die "no index at $IDX"
  python3 - "$IDX" <<'PY' | while IFS=$'\t' read -r src id spans flags; do
import json,sys
for e in json.load(open(sys.argv[1])):
    spans = e.get("spans") or [[e["srcStart"], e["srcEnd"]]]
    flags = "--silent" if e.get("audio","").startswith("silent") else "-"
    print("\t".join([e["srcReel"], e["id"], ",".join(f"{a}-{b}" for a,b in spans), flags]))
PY
    [ "$flags" = "-" ] && flags=""
    "$0" "$src" --id "$id" --span "$spans" $flags "$@" </dev/null || die "failed on $id"
  done
  exit 0
fi

INPUT=""; ID=""; SPANS=""; SILENT=0; SIL_BELOW=-50; DO_APP=1; DO_MASTER=1; MAXKB=2048
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --id) ID="${2:?}"; shift 2 ;;
    --span|--spans) SPANS="${2:?}"; shift 2 ;;
    --silent) SILENT=1; shift ;;
    --silent-below) SIL_BELOW="${2:?}"; shift 2 ;;
    --app-only) DO_MASTER=0; shift ;;
    --master-only) DO_APP=0; shift ;;
    --max-kb) MAXKB="${2:?}"; shift 2 ;;
    -*) die "unknown option $1 (see --help)" ;;
    *) [ -z "$INPUT" ] || die "only one source allowed"; INPUT="$1"; shift ;;
  esac
done
[ -n "$INPUT" ] || { usage >&2; die "a source is required"; }
[[ "$ID" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "--id must be lowercase letters, digits, hyphens: '$ID'"
[ -n "$SPANS" ] || die "--span is required"

# ---- source ----------------------------------------------------------------------
if [ -f "$INPUT" ]; then SRC="$INPUT"; else
  SRC=""
  for f in "$SRC_DIR/$INPUT".*; do
    case "$f" in *.analysis.log|*.analysis.json|*.part|*.ytdl) continue ;; esac
    [ -f "$f" ] && { SRC="$f"; break; }
  done
  [ -n "$SRC" ] || die "source '$INPUT' is not on disk ($SRC_DIR/$INPUT.*) — no downloads here"
fi
HAS_A=0
ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$SRC" | grep -q audio && HAS_A=1 || true
ACH="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of csv=p=0 "$SRC" | head -1)"; ACH="${ACH:-1}"
[ "$ACH" -gt 2 ] && ACH=2
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | head -1)"

# ---- spans -------------------------------------------------------------------------
SPANLIST="$(python3 - "$SPANS" "$DUR" <<'PY'
import sys
def secs(s):
    t=0.0
    for x in s.strip().split(":"): t=t*60+float(x)
    return t
spans=[]
for it in sys.argv[1].split(","):
    a,b=it.split("-"); a,b=secs(a),secs(b)
    if b<=a: sys.exit(f"bad span {it}")
    if b>float(sys.argv[2])+0.5: sys.exit(f"span {it} runs past the source end ({sys.argv[2]} s)")
    spans.append((a,b))
if len(spans)>3: sys.exit("at most 3 spans (hard cuts)")
if sum(b-a for a,b in spans)>180.5: sys.exit("total over 3:00")
for a,b in spans: print(f"{a}\t{b}")
PY
)" || die "bad --span"
NSPAN="$(printf '%s\n' "$SPANLIST" | wc -l | tr -d ' ')"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/cut-testcard.$ID.XXXXXX")"; trap 'rm -rf "$TMP"' EXIT
VF="scale=192:144:force_original_aspect_ratio=decrease,pad=192:144:-1:-1,hue=s=0,fps=12,format=yuv420p"
AF="highpass=f=200,lowpass=f=6000,aformat=channel_layouts=mono"

# ---- master ------------------------------------------------------------------------
if [ "$DO_MASTER" = 1 ]; then
  mkdir -p "$MASTER_DIR"; : > "$TMP/m.txt"; i=0
  while IFS=$'\t' read -r s e; do
    i=$((i+1)); seg="$TMP/m$i.mp4"
    if [ "$HAS_A" = 1 ]; then
      ffmpeg -hide_banner -nostdin -loglevel error -y -ss "$s" -to "$e" -i "$SRC" -map 0:v:0 -map 0:a:0 -sn -dn \
        -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 128k -ac "$ACH" -ar 48000 "$seg"
    else
      ffmpeg -hide_banner -nostdin -loglevel error -y -ss "$s" -to "$e" -i "$SRC" -map 0:v:0 -sn -dn \
        -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "$seg"
    fi
    echo "file '$seg'" >> "$TMP/m.txt"
  done <<< "$SPANLIST"
  ffmpeg -hide_banner -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/m.txt" -c copy -movflags +faststart "$MASTER_DIR/$ID.mp4"
  log "master $MASTER_DIR/$ID.mp4 ($(du -h "$MASTER_DIR/$ID.mp4" | cut -f1))"
fi

# ---- app clip ----------------------------------------------------------------------
if [ "$DO_APP" = 1 ]; then
  mkdir -p "$OUT_DIR"; : > "$TMP/a.txt"; i=0
  while IFS=$'\t' read -r s e; do
    i=$((i+1)); seg="$TMP/a$i.mkv"
    if [ "$HAS_A" = 1 ] && [ "$SILENT" = 0 ]; then
      ffmpeg -hide_banner -nostdin -loglevel error -y -ss "$s" -to "$e" -i "$SRC" -map 0:v:0 -map 0:a:0 -sn -dn \
        -vf "$VF" -af "$AF" -c:v libx264 -preset veryfast -crf 16 -c:a pcm_s16le -ar 48000 "$seg"
    else
      len="$(awk "BEGIN{print $e-$s}")"
      ffmpeg -hide_banner -nostdin -loglevel error -y -ss "$s" -to "$e" -i "$SRC" -f lavfi -t "$len" -i anullsrc=r=48000:cl=mono \
        -map 0:v:0 -map 1:a:0 -sn -dn -shortest -vf "$VF" -c:v libx264 -preset veryfast -crf 16 -c:a pcm_s16le -ar 48000 "$seg"
    fi
    echo "file '$seg'" >> "$TMP/a.txt"
  done <<< "$SPANLIST"

  AFIN="anull"; MODE="silent"
  if [ "$HAS_A" = 1 ] && [ "$SILENT" = 0 ]; then
    LN="$(ffmpeg -hide_banner -nostdin -f concat -safe 0 -i "$TMP/a.txt" -vn \
          -af "loudnorm=I=-18:TP=-2:LRA=9:print_format=json" -f null - 2>&1 | python3 -c '
import sys, json, re
m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", sys.stdin.read(), re.S)
d = json.loads(m.group(0)) if m else {}
if d:
    print(d["input_i"], ":".join(["measured_%s=%s" % (k, d.get("input_" + k.lower(), 0)) for k in ("I","TP","LRA","thresh")] + ["offset=%s" % d.get("target_offset", 0)]))
')"
    IN_I="${LN%% *}"; LNP="${LN#* }"
    if [ -n "$LN" ] && [ "$IN_I" != "-inf" ] && awk "BEGIN{exit !($IN_I >= $SIL_BELOW)}"; then
      AFIN="loudnorm=I=-18:TP=-2:LRA=9:$LNP:linear=true"; MODE="loudnorm (in ${IN_I} LUFS)"
    else
      log "span measures ${IN_I:-?} LUFS (< $SIL_BELOW): writing a silent track, not normalising"
      AFIN="volume=0"; MODE="silent (source ${IN_I:-?} LUFS)"
    fi
  fi

  OUT="$OUT_DIR/$ID.mp4"
  for CRF in 30 33 36 39 42; do
    ffmpeg -hide_banner -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/a.txt" -af "$AFIN" -r 12 \
      -c:v libx264 -preset slow -tune stillimage -crf "$CRF" -g 48 -keyint_min 12 -pix_fmt yuv420p \
      -c:a aac -b:a 32k -ac 1 -ar 48000 -movflags +faststart "$OUT"
    KB=$(( $(stat -f%z "$OUT") / 1024 ))
    [ "$KB" -le "$MAXKB" ] && break
    log "crf $CRF gives $KB KB > $MAXKB KB; raising crf"
  done
  RD="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | head -1)"
  printf '▸ app    %s  (%d span(s), %.1f s, %d KB, crf %s, audio %s)\n' "${OUT#$REPO/}" "$NSPAN" "$RD" "$KB" "$CRF" "$MODE" >&2
fi
exit 0
} # end of the parse-first wrapper — nothing may follow this line
