//go:build noembed

package main

import (
	"io/fs"
	"testing/fstest"
)

// webFS is a minimal in-memory filesystem used during linting and testing
// when the real web/dist assets have not been built yet.
// Build with -tags noembed to use this stub.
var webFS fs.FS = fstest.MapFS{
	"index.html": &fstest.MapFile{Data: []byte("<html><body>stub</body></html>")},
}
