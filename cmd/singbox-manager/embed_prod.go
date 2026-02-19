//go:build !noembed

package main

import (
	"embed"
	"io/fs"
)

// 包含所有文件，包括以 "." 开头的隐藏文件
//go:embed all:web/dist
var embeddedFS embed.FS

// webFS 会剥离 "web/dist" 前缀，
// 使得 fs.Open("index.html") 实际上打开的是 web/dist/index.html
var webFS fs.FS

func init() {
	var err error
	webFS, err = fs.Sub(embeddedFS, "web/dist")
	if err != nil {
		panic(err)
	}
}
