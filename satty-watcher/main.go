package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/joho/godotenv"
)

// Cache stores the filename and the Unix timestamp of when it was first seen
type Cache map[string]int64

func main() {
	// Load .env from the same directory as the binary
	exePath, _ := os.Executable()
	_ = godotenv.Load(filepath.Join(filepath.Dir(exePath), ".env"))

	watchDir := os.Getenv("WATCH_DIR")
	sattyPath := os.Getenv("SATTY_PATH")
	cachePath := os.Getenv("CACHE_FILE")
	fileExt := os.Getenv("FILE_EXT")

	cache := loadCache(cachePath)

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	defer watcher.Close()

	fmt.Printf("Watching: %s\n", watchDir)

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				// Create or Write events
				if event.Op&fsnotify.Create == fsnotify.Create || event.Op&fsnotify.Write == fsnotify.Write {
					if filepath.Ext(event.Name) != fileExt {
						continue
					}

					// If not in cache, it's new
					if _, exists := cache[event.Name]; !exists {
						fmt.Printf("New screenshot: %s\n", event.Name)
						
						cache[event.Name] = time.Now().Unix()
						
						// Run cleanup before saving to keep file small
						cleanupCache(cache)
						saveCache(cachePath, cache)

						cmd := exec.Command(sattyPath, "--filename", event.Name, "--output-filename", event.Name)
						if err := cmd.Start(); err != nil {
							log.Printf("Satty error: %v", err)
						}
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Println("Watcher error:", err)
			}
		}
	}()

	err = watcher.Add(watchDir)
	if err != nil {
		log.Fatal(err)
	}
	select {} 
}

func cleanupCache(c Cache) {
	threshold := time.Now().Add(-24 * time.Hour).Unix()
	for path, timestamp := range c {
		if timestamp < threshold {
			delete(c, path)
		}
	}
}

func loadCache(path string) Cache {
	data, err := os.ReadFile(path)
	if err != nil {
		return make(Cache)
	}
	var c Cache
	json.Unmarshal(data, &c)
	return c
}

func saveCache(path string, c Cache) {
	data, _ := json.Marshal(c)
	os.WriteFile(path, data, 0644)
}
