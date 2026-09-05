#!/usr/bin/env bash
# make-reel.sh — cut a ZANKYŌ broadcast reel from a URL or a local file.
#
# A reel is one small MP4 of 6–10 non-contiguous ~12 s windows from one
# source, encoded to the plan's §5.1–5.2 format (192×144 grayscale 12 fps
# H.264 + 32 kbps mono band-passed AAC), plus one manifest JSON per reel.
# See --help. Runs on the owner's Mac only (needs ffmpeg + yt-dlp).
set -euo pipefail

usage() {
  cat <<'EOF'
usage: make-reel.sh <url-or-file> --id <slug> [options]

  --id <slug>            reel id: lowercase, digits, hyphens (file name of the reel)
  --windows t1,t2,…      window START times in the source (seconds, m:ss or h:mm:ss;
                         "83-95" gives an explicit range). Without this the tool
                         PROPOSES windows (scene changes + loudness gate) and prints them.
  --window-len N         seconds per window (default 12; music ≤ 10)
  --max-windows N        cap on proposed windows (default 8; Tier B is capped at 6)
  --audio-only           source is audio (or use its audio only); a picture is generated
  --picture static|line|wave
                         generated picture for --audio-only (default line):
                         static = slow noise field, line = one line of light (Paik's
                         Zen for TV), wave = the line drawn by the audio
  --tier A|B             A = free to use (default), B = copyrighted (≤ 6 windows)
  --title "…"  --year N  --license "PD|CC-BY|CC-BY-NC|unknown|…"  (default unknown)
  --tone voice|music|noise|sung|tone   (default voice)
  --weight 1..5          lottery weight (default 3)
  --notes "…"            one line for the manifest
  --propose              analyze and print proposed windows only; cut nothing
  --force-analyze        ignore the cached analysis in local-dev/broadcast-src
  -h, --help

Outputs (relative to art/zankyo/broadcast/):
  reels/<id>.mp4        the reel        manifest/<id>.json   its manifest entry
Raw downloads go to local-dev/broadcast-src/<id>.<ext> (gitignored; kept for re-cuts).
Re-run with --windows to override the proposal; the reel and json are rewritten.
EOF
}

die() { echo "make-reel: $*" >&2; exit 1; }
log() { echo "▸ $*" >&2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$(cd "$HERE/.." && pwd)"                       # art/zankyo/broadcast
REPO="$(cd "$BC/../../.." && pwd)"
SRC_DIR="$REPO/local-dev/broadcast-src"
REELS="$BC/reels"; MANI="$BC/manifest"
mkdir -p "$SRC_DIR" "$REELS" "$MANI"

command -v ffmpeg >/dev/null || die "ffmpeg not found — brew install ffmpeg"
command -v ffprobe >/dev/null || die "ffprobe not found — brew install ffmpeg"
YTDLP="$(command -v yt-dlp || true)"; [ -n "$YTDLP" ] || YTDLP="$HOME/anaconda3/bin/yt-dlp"

# ---- args -------------------------------------------------------------------
INPUT=""; ID=""; WINDOWS=""; WLEN=12; MAXW=""; AUDIO_ONLY=0; PICTURE="line"; TIER="A"
TITLE=""; YEAR=""; LICENSE="unknown"; TONE="voice"; WEIGHT=3; NOTES=""; PROPOSE=0; FORCE_AN=0
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --id) ID="${2:?}"; shift 2 ;;
    --windows) WINDOWS="${2:?}"; shift 2 ;;
    --window-len) WLEN="${2:?}"; shift 2 ;;
    --max-windows) MAXW="${2:?}"; shift 2 ;;
    --audio-only) AUDIO_ONLY=1; shift ;;
    --picture) PICTURE="${2:?}"; shift 2 ;;
    --tier) TIER="${2:?}"; shift 2 ;;
    --title) TITLE="${2:?}"; shift 2 ;;
    --year) YEAR="${2:?}"; shift 2 ;;
    --license) LICENSE="${2:?}"; shift 2 ;;
    --tone) TONE="${2:?}"; shift 2 ;;
    --weight) WEIGHT="${2:?}"; shift 2 ;;
    --notes) NOTES="${2:?}"; shift 2 ;;
    --propose) PROPOSE=1; shift ;;
    --force-analyze) FORCE_AN=1; shift ;;
    -*) die "unknown option $1 (see --help)" ;;
    *) [ -z "$INPUT" ] || die "only one input allowed (got '$INPUT' and '$1')"; INPUT="$1"; shift ;;
  esac
done
[ -n "$INPUT" ] || { usage >&2; die "an input URL or file is required"; }
[ -n "$ID" ] || die "--id <slug> is required"
[[ "$ID" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "--id must be lowercase letters, digits, hyphens: '$ID'"
[[ "$TIER" =~ ^[AB]$ ]] || die "--tier must be A or B"
[[ "$TONE" =~ ^(voice|music|noise|sung|tone)$ ]] || die "--tone must be voice|music|noise|sung|tone"
[[ "$WEIGHT" =~ ^[1-5]$ ]] || die "--weight must be 1..5"
[[ "$PICTURE" =~ ^(static|line|wave)$ ]] || die "--picture must be static|line|wave"
[[ "$WLEN" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "--window-len must be a number of seconds"
[ -z "$YEAR" ] || [[ "$YEAR" =~ ^[0-9]{4}$ ]] || die "--year must be a 4-digit year"
if [ -z "$MAXW" ]; then MAXW=8; [ "$TIER" = B ] && MAXW=6; fi
[[ "$MAXW" =~ ^[0-9]+$ ]] || die "--max-windows must be an integer"
if [ "$TIER" = B ] && [ "$MAXW" -gt 6 ]; then log "Tier B: capping --max-windows at 6 (plan §5.5)"; MAXW=6; fi
if [ "$TONE" = music ] && awk "BEGIN{exit !($WLEN > 10)}"; then
  log "WARNING: music windows should be ≤ 10 s (plan §5.5) — you asked for $WLEN"
fi

# ---- 1. source: local file, cached download, or yt-dlp ----------------------
SRC=""
if [ -f "$INPUT" ]; then
  SRC="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"
  SRC_REF="$(basename "$INPUT")"
  log "source: local file $SRC"
else
  SRC_REF="$INPUT"
  for f in "$SRC_DIR/$ID".*; do
    case "$f" in *.analysis.log|*.analysis.json|*.part|*.ytdl) continue ;; esac
    [ -f "$f" ] && { SRC="$f"; break; }
  done
  if [ -n "$SRC" ]; then
    log "source: cached download $SRC (delete it to re-download)"
  else
    [ -x "$YTDLP" ] || die "yt-dlp not found (looked at $YTDLP)"
    if [ "$AUDIO_ONLY" = 1 ]; then FMT="ba/b"; else FMT="bv*[height<=480]+ba/b[height<=480]/b"; fi
    log "downloading with yt-dlp → $SRC_DIR/$ID.<ext>"
    if ! "$YTDLP" --no-playlist -I 1 --no-mtime --no-warnings -f "$FMT" \
         -o "$SRC_DIR/$ID.%(ext)s" "$INPUT" >&2; then
      case "$INPUT" in
        *.mp4|*.mkv|*.webm|*.mov|*.avi|*.mpg|*.mpeg|*.ogv|*.mp3|*.m4a|*.wav|*.flac|*.ogg|*.oga|*.aac)
          log "yt-dlp failed; fetching the file directly with curl"
          curl -fL --retry 3 -o "$SRC_DIR/$ID.${INPUT##*.}" "$INPUT" >&2 || die "download failed: $INPUT" ;;
        *) die "yt-dlp could not download $INPUT" ;;
      esac
    fi
    for f in "$SRC_DIR/$ID".*; do
      case "$f" in *.analysis.log|*.analysis.json|*.part|*.ytdl) continue ;; esac
      [ -f "$f" ] && { SRC="$f"; break; }
    done
    [ -n "$SRC" ] || die "download produced no file at $SRC_DIR/$ID.*"
    log "downloaded $SRC ($(du -h "$SRC" | cut -f1))"
  fi
fi

# ---- 2. probe ---------------------------------------------------------------
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | head -1)"
[[ "$DUR" =~ ^[0-9] ]] || die "ffprobe could not read a duration from $SRC"
HAS_V=0; HAS_A=0
ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$SRC" | grep -q video && HAS_V=1 || true
ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$SRC" | grep -q audio && HAS_A=1 || true
# yt-dlp's audio-only .mp4/.m4a can carry a cover-art "video" stream; treat attached pictures as no video
if [ "$HAS_V" = 1 ]; then
  VFR="$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$SRC" | head -1)"
  case "$VFR" in 0/0|0|"") HAS_V=0 ;; esac
fi
if [ "$HAS_V" = 0 ] && [ "$AUDIO_ONLY" = 0 ]; then log "no video stream — switching to --audio-only"; AUDIO_ONLY=1; fi
[ "$HAS_A" = 1 ] || [ "$AUDIO_ONLY" = 0 ] || die "source has neither usable video nor audio"
[ "$HAS_A" = 1 ] || log "WARNING: source has no audio track; the reel will be silent"
printf '▸ source duration %.1f s  video=%s audio=%s\n' "$DUR" "$HAS_V" "$HAS_A" >&2

# ---- 3. windows: given or proposed -----------------------------------------
to_secs() {  # 1:23 → 83 ; 1:02:03.5 → 3723.5 ; 83 → 83
  python3 -c 'import sys
s=sys.argv[1].strip(); p=s.split(":"); t=0.0
for x in p: t=t*60+float(x)
print(t)' "$1"
}
WINJSON=""
if [ -n "$WINDOWS" ]; then
  WINJSON="["
  IFS=',' read -ra items <<< "$WINDOWS"
  for it in "${items[@]}"; do
    it="${it// /}"; [ -n "$it" ] || continue
    if [[ "$it" == *-* ]]; then s="$(to_secs "${it%-*}")"; e="$(to_secs "${it#*-}")"
    else s="$(to_secs "$it")"; e="$(awk "BEGIN{print $s+$WLEN}")"; fi
    awk "BEGIN{exit !($e > $s)}" || die "bad window '$it' (end before start)"
    awk "BEGIN{exit !($s >= 0 && $e <= $DUR + 0.5)}" || die "window '$it' falls outside the source (duration ${DUR}s)"
    WINJSON+="[$s,$e],"
  done
  WINJSON="${WINJSON%,}]"
  NWIN="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])))' "$WINJSON")"
  [ "$NWIN" -ge 1 ] || die "--windows parsed to nothing"
  if [ "$TIER" = B ] && [ "$NWIN" -gt 6 ]; then die "Tier B reels may carry at most 6 windows (plan §5.5); you gave $NWIN"; fi
  python3 - "$WINJSON" <<'PY' || die "windows overlap"
import json,sys; w=sorted(json.loads(sys.argv[1]))
for a,b in zip(w,w[1:]):
    if b[0] < a[1]: sys.exit(1)
PY
  log "using $NWIN given window(s)"
else
  AN="$SRC_DIR/$ID.analysis.log"
  if [ "$FORCE_AN" = 1 ] || [ ! -s "$AN" ] || [ "$AN" -ot "$SRC" ]; then
    log "analyzing (scene changes, black, loudness) … this is the slow step"
    FC=""; MAPS=()
    if [ "$AUDIO_ONLY" = 0 ]; then
      FC="[0:v]scale=160:120,split[sa][sb];[sa]select='gt(scene,0.35)',showinfo[vo];[sb]blackdetect=d=0.5:pix_th=0.10[bo]"
      MAPS+=(-map "[vo]" -map "[bo]")
    fi
    if [ "$HAS_A" = 1 ]; then
      [ -n "$FC" ] && FC+=";"
      FC+="[0:a]aformat=channel_layouts=mono,ebur128=peak=none[ao]"
      MAPS+=(-map "[ao]")
    fi
    ffmpeg -hide_banner -nostdin -threads 0 -i "$SRC" -filter_complex "$FC" "${MAPS[@]}" -f null - 2> "$AN.tmp" \
      || { tail -5 "$AN.tmp" >&2; rm -f "$AN.tmp"; die "analysis pass failed"; }
    mv "$AN.tmp" "$AN"
  else
    log "using cached analysis $AN (--force-analyze to redo)"
  fi
  AOFLAG=""; [ "$AUDIO_ONLY" = 1 ] && AOFLAG="--audio-only"
  PROP="$(python3 "$HERE/reel-propose.py" "$AN" "$DUR" "$WLEN" "$MAXW" $AOFLAG)"
  WINJSON="$(python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["windows"]))' "$PROP")"
  NWIN="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])))' "$WINJSON")"
  python3 - "$PROP" <<'PY' >&2
import json,sys; p=json.loads(sys.argv[1])
print(f"▸ proposed {len(p['windows'])} windows from {p.get('candidates',0)} candidates "
      f"(scene cuts: {p.get('scenes','-')}, rejected quiet: {p.get('rejected',{}).get('quiet',0)}, black: {p.get('rejected',{}).get('black',0)})")
if p.get('note'): print("▸ note:", p['note'])
PY
fi

fmt_t() { python3 -c 'import sys; t=float(sys.argv[1]); print(f"{int(t//60)}:{t%60:05.2f}")' "$1"; }
echo "▸ windows in the source (re-run with --windows to override):" >&2
python3 - "$WINJSON" <<'PY' >&2
import json,sys
w=json.loads(sys.argv[1])
def f(t): return f"{int(t//60)}:{t%60:05.2f}"
for i,(s,e) in enumerate(w,1): print(f"    {i:2d}. {f(s)} – {f(e)}   ({s:.2f}-{e:.2f})")
print("  --windows " + ",".join(f"{s:.2f}-{e:.2f}" for s,e in w))
PY
if [ "$PROPOSE" = 1 ]; then log "--propose: stopping before the cut"; exit 0; fi

# ---- 4. cut each window to an intermediate ---------------------------------
TMP="$(mktemp -d "${TMPDIR:-/tmp}/make-reel.$ID.XXXXXX")"; trap 'rm -rf "$TMP"' EXIT
VF="scale=192:144:force_original_aspect_ratio=decrease,pad=192:144:-1:-1,hue=s=0,fps=12,format=yuv420p"
AF="highpass=f=200,lowpass=f=6000"
: > "$TMP/list.txt"
i=0
while IFS=$'\t' read -r s e; do
  i=$((i+1)); len="$(awk "BEGIN{print $e-$s}")"
  seg="$TMP/seg$(printf %02d $i).mkv"
  log "cutting window $i/$NWIN  $(fmt_t "$s") +${len}s"
  if [ "$AUDIO_ONLY" = 1 ]; then
    ffmpeg -hide_banner -nostdin -loglevel error -ss "$s" -t "$len" -i "$SRC" -vn \
      -af "$AF,aformat=channel_layouts=mono" -c:a pcm_s16le -ar 48000 "$seg"
  elif [ "$HAS_A" = 1 ]; then
    ffmpeg -hide_banner -nostdin -loglevel error -ss "$s" -t "$len" -i "$SRC" \
      -vf "$VF" -af "$AF,aformat=channel_layouts=mono" -map 0:v:0 -map 0:a:0 -sn -dn \
      -c:v libx264 -preset veryfast -crf 16 -c:a pcm_s16le -ar 48000 "$seg"
  else
    ffmpeg -hide_banner -nostdin -loglevel error -ss "$s" -t "$len" -i "$SRC" -f lavfi -t "$len" -i anullsrc=r=48000:cl=mono \
      -vf "$VF" -map 0:v:0 -map 1:a:0 -sn -dn -shortest \
      -c:v libx264 -preset veryfast -crf 16 -c:a pcm_s16le -ar 48000 "$seg"
  fi
  echo "file '$seg'" >> "$TMP/list.txt"
done < <(python3 -c 'import json,sys
for s,e in json.loads(sys.argv[1]): print(f"{s}\t{e}")' "$WINJSON")

# reel-relative window positions from the intermediates' real durations
REELWIN="$(python3 - "$TMP" "$NWIN" <<'PY'
import json,subprocess,sys
tmp,n=sys.argv[1],int(sys.argv[2]); t=0.0; out=[]
for i in range(1,n+1):
    d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"{tmp}/seg{i:02d}.mkv"]).decode().strip())
    out.append([round(t,2),round(t+d,2)]); t+=d
print(json.dumps(out))
PY
)"

# ---- 5. concatenate + final encode (two-pass loudnorm) ----------------------
OUT="$REELS/$ID.mp4"
log "measuring loudness for loudnorm"
LN="$(ffmpeg -hide_banner -nostdin -f concat -safe 0 -i "$TMP/list.txt" -vn \
      -af "loudnorm=I=-18:TP=-2:LRA=9:print_format=json" -f null - 2>&1 | python3 -c '
import sys, json, re
txt = sys.stdin.read()
m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", txt, re.S)
d = json.loads(m.group(0)) if m else {}
if d:
    parts = ["measured_%s=%s" % (k, d.get("input_" + k.lower(), 0)) for k in ("I", "TP", "LRA", "thresh")]
    parts.append("offset=%s" % d.get("target_offset", 0))
    print(":".join(parts))
')"
if [ -n "$LN" ] && ! [[ "$LN" == *"measured_I=-inf"* ]]; then LNF="loudnorm=I=-18:TP=-2:LRA=9:$LN:linear=true"; else LNF="loudnorm=I=-18:TP=-2:LRA=9"; fi

if [ "$AUDIO_ONLY" = 1 ]; then
  case "$PICTURE" in
    static) PIC="nullsrc=s=192x144:r=12,geq=lum='random(1)*255':cb=128:cr=128,tmix=frames=3,format=yuv420p" ;;
    line)   PIC="nullsrc=s=192x144:r=12,geq=lum='if(lt(abs(Y-72),1),200+55*random(1),if(lt(abs(Y-72),3),40+10*random(1),8))':cb=128:cr=128,format=yuv420p" ;;
    wave)   PIC="" ;;
  esac
  log "encoding reel with a generated '$PICTURE' picture"
  if [ "$PICTURE" = wave ]; then
    ffmpeg -hide_banner -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" \
      -filter_complex "[0:a]$LNF,asplit[a1][a2];[a2]showwaves=s=192x144:mode=p2p:rate=12:colors=0xd8d8d8:scale=lin,format=yuv420p[v]" \
      -map "[v]" -map "[a1]" \
      -c:v libx264 -preset slow -crf 30 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
      -c:a aac -b:a 32k -ac 1 -ar 48000 -movflags +faststart "$OUT"
  else
    ffmpeg -hide_banner -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -f lavfi -i "$PIC" \
      -map 1:v:0 -map 0:a:0 -shortest -af "$LNF" \
      -c:v libx264 -preset slow -crf 30 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
      -c:a aac -b:a 32k -ac 1 -ar 48000 -movflags +faststart "$OUT"
  fi
else
  log "encoding reel"
  ffmpeg -hide_banner -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" \
    -af "$LNF" -r 12 \
    -c:v libx264 -preset slow -crf 30 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
    -c:a aac -b:a 32k -ac 1 -ar 48000 -movflags +faststart "$OUT"
fi

# ---- 6. measure the reel, write the manifest entry -------------------------
MEAS="$(ffmpeg -hide_banner -nostdin -i "$OUT" -vn -af "ebur128=peak=none" -f null - 2>&1 | grep -A8 "Summary:" | awk '/I:/{print $2; exit}')"
[[ "$MEAS" =~ ^-?[0-9] ]] || MEAS="-18.0"
GAIN="$(awk "BEGIN{g=-18-($MEAS); if(g>12)g=12; if(g<-12)g=-12; printf \"%.1f\", g}")"
RDUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | head -1)"
BYTES="$(stat -f%z "$OUT")"

python3 - "$MANI/$ID.json" "$ID" "$TITLE" "$YEAR" "$SRC_REF" "$LICENSE" "$TIER" "$TONE" "$WEIGHT" "$GAIN" \
  "$RDUR" "$BYTES" "$AUDIO_ONLY" "$PICTURE" "$REELWIN" "$WINJSON" "$NOTES" <<'PY'
import json,sys
(_, out, id_, title, year, src, lic, tier, tone, weight, gain, rdur, nbytes, ao, pic, reelwin, srcwin, notes) = sys.argv
e = {
  "id": id_,
  "title": title or id_,
  "year": int(year) if year else None,
  "src": src,
  "license": lic,
  "tier": tier,
  "tone": tone,
  "weight": int(weight),
  "gain": float(gain),
  "durS": round(float(rdur), 2),
  "bytes": int(nbytes),
  "audioOnly": ao == "1",
  "picture": pic if ao == "1" else None,
  "windows": json.loads(reelwin),
  "srcWindows": json.loads(srcwin),
  "notes": notes,
  "takedown": False,
}
# one window per line, everything else one field per line
lines = ["{"]
keys = list(e)
for i, k in enumerate(keys):
    v = e[k]; comma = "," if i < len(keys) - 1 else ""
    if k in ("windows", "srcWindows"):
        body = ", ".join("[%s, %s]" % (a, b) for a, b in v)
        lines.append('  "%s": [%s]%s' % (k, body, comma))
    else:
        lines.append('  "%s": %s%s' % (k, json.dumps(v, ensure_ascii=False), comma))
lines.append("}")
with open(out, "w") as f:
    f.write("\n".join(lines) + "\n")
PY

printf '▸ reel   %s  (%d windows, %.1f s, %d KB, integrated %s LUFS, gain %s dB)\n' \
  "${OUT#$REPO/}" "$NWIN" "$RDUR" "$((BYTES/1024))" "$MEAS" "$GAIN" >&2
echo "▸ entry  ${MANI#$REPO/}/$ID.json" >&2
if [ "$BYTES" -gt 2097152 ]; then log "WARNING: reel is over 2 MB — fewer/shorter windows, please"; fi
echo "▸ audition: $(dirname "${HERE#$REPO/}")/tools/preview.sh $ID" >&2
