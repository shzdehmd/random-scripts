package main

import (
	"bytes"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	dirPath := flag.String("dir", "", "The target directory to scan")
	fileExt := flag.String("ext", "", "The file extension to look for (e.g., .dart)")
	commentSym := flag.String("comment", "//", "The comment symbol to use (e.g., // or #)")
	flag.Parse()

	if *dirPath == "" || *fileExt == "" {
		fmt.Println("Usage: add-filepaths -dir <directory> -ext <extension> -comment <symbol>")
		flag.PrintDefaults()
		os.Exit(1)
	}

	targetExt := *fileExt
	if !strings.HasPrefix(targetExt, ".") {
		targetExt = "." + targetExt
	}

	fmt.Printf("Scanning '%s' for '%s' files...\n", *dirPath, targetExt)

	err := filepath.WalkDir(*dirPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.EqualFold(filepath.Ext(path), targetExt) {
			processFile(path, *commentSym)
		}
		return nil
	})

	if err != nil {
		log.Fatalf("Error walking the path: %v", err)
	}
	fmt.Println("Done.")
}

func processFile(path string, commentSymbol string) {
	content, err := os.ReadFile(path)
	if err != nil {
		log.Printf("Failed to read file %s: %v", path, err)
		return
	}

	bom := []byte{0xEF, 0xBB, 0xBF}
	hasBOM := false
	if bytes.HasPrefix(content, bom) {
		hasBOM = true
		content = content[len(bom):]
	}

	newline := "\n"
	if bytes.Contains(content, []byte("\r\n")) {
		newline = "\r\n"
	}

	displayPath := filepath.ToSlash(path)
	
	header := fmt.Sprintf("%s %s%s", commentSymbol, displayPath, newline)
	headerBytes := []byte(header)

	if bytes.HasPrefix(content, headerBytes) {
		return
	}

	var newContent []byte

	if hasBOM {
		newContent = append(newContent, bom...)
	}

	newContent = append(newContent, headerBytes...)

	newContent = append(newContent, content...)

	info, err := os.Stat(path)
	if err != nil {
		log.Printf("Failed to get file info %s: %v", path, err)
		return
	}

	err = os.WriteFile(path, newContent, info.Mode())
	if err != nil {
		log.Printf("Failed to write to file %s: %v", path, err)
		return
	}

	fmt.Printf("Tagged: %s\n", path)
}
