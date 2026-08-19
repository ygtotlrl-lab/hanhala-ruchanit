#!/bin/bash
# Sign an APK with the PERMANENT hanhala-ruchanit key — signing/hanhala.keystore.
#
# ⛔ זה המפתח היחיד: חתימה בכל מפתח אחר מייצרת אפליקציה זרה, וכל המשתמשים
# ייתקלו ב-INSTALL_FAILED_UPDATE_INCOMPATIBLE בלי שום דרך חזרה.
# ר' CLAUDE.md, "חתימת APK".
#
# Requires Android build-tools on PATH (zipalign + apksigner).
# Usage: ./sign-apk.sh <unsigned.apk> [output.apk]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
KS="$HERE/hanhala.keystore"
ALIAS='hanhala'
PASS='hanhala123'
EXPECTED_SHA256='9F:68:B5:A0:0E:FA:D1:2F:19:C6:FF:E7:05:8E:D0:61:79:92:E6:99:9F:34:74:12:66:B0:93:93:E4:E1:6D:BF'

IN="${1:?usage: sign-apk.sh <unsigned.apk> [output.apk]}"
OUT="${2:-hanhala-ruchanit.apk}"
ALIGNED="${OUT%.apk}-aligned.apk"

for tool in zipalign apksigner; do
  command -v "$tool" >/dev/null || { echo "❌ $tool not on PATH (Android build-tools)" >&2; exit 1; }
done
[ -f "$KS" ] || { echo "❌ missing keystore: $KS" >&2; exit 1; }

# Fail before touching the APK if the keystore is not the key we expect. A wrong
# key here is unrecoverable for every existing install, so this is a hard gate.
if ! keytool -list -v -keystore "$KS" -storepass "$PASS" 2>/dev/null \
     | grep -qF "SHA256: $EXPECTED_SHA256"; then
  echo "❌ keystore fingerprint does NOT match the expected key. Refusing to sign." >&2
  echo "   expected SHA256: $EXPECTED_SHA256" >&2
  exit 1
fi

# zipalign must run before apksigner — apksigner preserves alignment, zipalign
# after signing would invalidate the v2/v3 signature.
zipalign -p -f 4 "$IN" "$ALIGNED"
apksigner sign \
  --ks "$KS" --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT" "$ALIGNED"
rm -f "$ALIGNED"

apksigner verify --print-certs "$OUT"

# Verify what actually landed in the APK, not just what we asked for.
# apksigner prints the digest lowercase and WITHOUT colons, while keytool prints
# it uppercase WITH colons — so both sides get normalised before comparing.
# Matching the colon form against apksigner output never succeeds.
normalise() { tr -d ':' | tr 'A-Z' 'a-z'; }
WANT="$(printf '%s' "$EXPECTED_SHA256" | normalise)"
GOT="$(apksigner verify --print-certs "$OUT" \
       | grep -i 'SHA-256 digest' | head -1 | awk '{print $NF}' | normalise)"
if [ "$WANT" != "$GOT" ]; then
  echo "❌ signed APK does not carry the expected certificate!" >&2
  echo "   expected: $WANT" >&2
  echo "   actual:   $GOT" >&2
  exit 1
fi

echo "✅ Signed with the permanent hanhala-ruchanit key -> $OUT"
echo "   SHA256 $EXPECTED_SHA256"
