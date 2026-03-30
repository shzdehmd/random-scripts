package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	var ext, dir, out string
	flag.StringVar(&ext, "ext", "", "file extension (e.g., 'md' or '.md')")
	flag.StringVar(&dir, "dir", ".", "root directory to search")
	flag.StringVar(&out, "out", "combined.txt", "output file name")
	flag.Parse()

	if ext == "" {
		fmt.Fprintln(os.Stderr, "error: extension must be provided")
		os.Exit(1)
	}

	// Ensure extension starts with a dot
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}

	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// Skip directories and non-regular files (symlinks, devices, etc.)
		if !info.Mode().IsRegular() {
			return nil
		}
		if filepath.Ext(path) == ext {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error walking directory: %v\n", err)
		os.Exit(1)
	}

	// Get absolute path of the output file to avoid including it
	absOut, err := filepath.Abs(out)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error resolving output path: %v\n", err)
		os.Exit(1)
	}

	// Filter out the output file if it appears in the list
	var filtered []string
	for _, f := range files {
		absFile, err := filepath.Abs(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skipping %q (cannot resolve): %v\n", f, err)
			continue
		}
		if absFile == absOut {
			continue
		}
		filtered = append(filtered, f)
	}
	files = filtered

	// Create output file
	outFile, err := os.Create(out)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	// Concatenate each file, adding a newline separator
	for _, f := range files {
		inFile, err := os.Open(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skipping %q: %v\n", f, err)
			continue
		}
		_, err = io.Copy(outFile, inFile)
		if err != nil {
			inFile.Close()
			fmt.Fprintf(os.Stderr, "warning: error copying %q: %v\n", f, err)
			continue
		}
		// Add a newline to separate files (ensures at least one blank line between them)
		outFile.WriteString("\n")
		inFile.Close()
	}

	fmt.Printf("Combined %d files into %s\n", len(files), out)
}
