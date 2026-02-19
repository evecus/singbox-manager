//go:build !noembed

package main

import (
	"embed"
	"io/fs"
)

//go:embed web
var embeddedFS embed.FS

// webFS exposes the embedded web directory as a plain fs.FS.
var webFS fs.FS = embeddedFS
