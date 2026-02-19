//go:build !noembed

package main

import (
	"embed"
	"io/fs"
)

//go:embed web/dist
var embeddedFS embed.FS

// webFS exposes the embedded web/dist directory as a plain fs.FS.
var webFS fs.FS = embeddedFS
