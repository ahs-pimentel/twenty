#!/bin/sh

if [ -z "$REACT_APP_SERVER_BASE_URL" ]; then
  echo "Error: REACT_APP_SERVER_BASE_URL is not set."
  exit 1
fi

echo "Injecting runtime environment variables into index.html..."

CONFIG_BLOCK=$(cat << EOF
    <script id="twenty-env-config">
      window._env_ = {
        REACT_APP_SERVER_BASE_URL: "$REACT_APP_SERVER_BASE_URL"
      };
    </script>
    <!-- END: Twenty Config -->
EOF
)
# Use sed to replace the config block in index.html
# Using pattern space to match across multiple lines
echo "$CONFIG_BLOCK" | sed -i.bak '
  /<!-- BEGIN: Twenty Config -->/,/<!-- END: Twenty Config -->/{
    /<!-- BEGIN: Twenty Config -->/!{
      /<!-- END: Twenty Config -->/!d
    }
    /<!-- BEGIN: Twenty Config -->/r /dev/stdin
    /<!-- END: Twenty Config -->/d
  }
' build/index.html
rm -f build/index.html.bak

# BEGIN: O2D-PATCH: P2 — optional boot-time override of the distribution
# product name inside the delimited O2D Branding block (full block content is
# generated at build time by generateDistributionArtifact.ts).
if [ -n "$O2D_PRODUCT_NAME" ]; then
  echo "Injecting O2D product name into index.html..."
  sed -i.bak "s/document\.title = \"[^\"]*\";/document.title = \"$O2D_PRODUCT_NAME\";/" build/index.html
  rm -f build/index.html.bak
fi
# END: O2D-PATCH: P2
