package main

import (
	"flag"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"
	"strings"

	"golang.org/x/image/draw"
)

func main() {
	inputPath := flag.String("i", "", "Input image path (required)")
	width := flag.Int("w", 100, "Output width in terminal characters")
	dither := flag.Bool("dither", true, "Apply Floyd-Steinberg dithering")
	colorFlag := flag.Bool("color", false, "Output true-color ANSI codes")
	invert := flag.Bool("invert", false, "Invert luminance threshold for light/dark backgrounds")
	threshold := flag.Float64("t", 128.0, "Luminance threshold 0-255")

	flag.Parse()

	if *inputPath == "" {
		fmt.Fprintln(os.Stderr, "Error: -i flag is required")
		flag.Usage()
		os.Exit(1)
	}

	f, err := os.Open(*inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening image: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	srcImg, _, err := image.Decode(f)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding image: %v\n", err)
		os.Exit(1)
	}

	srcBounds := srcImg.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	targetPxW := *width * 2

	aspectRatio := float64(srcH) / float64(srcW)
	targetPxH := int(math.Round(float64(targetPxW) * aspectRatio))
	targetPxH = ((targetPxH + 3) / 4) * 4

	scaled := image.NewRGBA(image.Rect(0, 0, targetPxW, targetPxH))
	draw.CatmullRom.Scale(scaled, scaled.Bounds(), srcImg, srcBounds, draw.Over, nil)

	lum := make([][]float64, targetPxH)
	for y := 0; y < targetPxH; y++ {
		lum[y] = make([]float64, targetPxW)
		for x := 0; x < targetPxW; x++ {
			r, g, b, _ := scaled.RGBAAt(x, y).RGBA()
			lum[y][x] = 0.299*float64(r>>8) + 0.587*float64(g>>8) + 0.114*float64(b>>8)
		}
	}

	if *dither {
		applyFloydSteinberg(lum, targetPxW, targetPxH)
	}

	thr := *threshold
	if *invert {
		thr = 255.0 - thr
	}

	charH := targetPxH / 4
	var sb strings.Builder

	for cy := 0; cy < charH; cy++ {
		for cx := 0; cx < *width; cx++ {
			px := cx * 2
			py := cy * 4

			var dotBits rune

			if lum[py][px] >= thr {
				dotBits |= 0x01
			}
			if lum[py][px+1] >= thr {
				dotBits |= 0x08
			}
			if lum[py+1][px] >= thr {
				dotBits |= 0x02
			}
			if lum[py+1][px+1] >= thr {
				dotBits |= 0x10
			}
			if lum[py+2][px] >= thr {
				dotBits |= 0x04
			}
			if lum[py+2][px+1] >= thr {
				dotBits |= 0x20
			}
			if lum[py+3][px] >= thr {
				dotBits |= 0x40
			}
			if lum[py+3][px+1] >= thr {
				dotBits |= 0x80
			}

			ch := rune(0x2800) + dotBits

			if *colorFlag {
				var sumR, sumG, sumB uint32
				count := 0
				for dy := 0; dy < 4; dy++ {
					for dx := 0; dx < 2; dx++ {
						r, g, b, _ := scaled.RGBAAt(px+dx, py+dy).RGBA()
						sumR += r >> 8
						sumG += g >> 8
						sumB += b >> 8
						count++
					}
				}
				avgR := sumR / uint32(count)
				avgG := sumG / uint32(count)
				avgB := sumB / uint32(count)
				sb.WriteString(fmt.Sprintf("\x1b[38;2;%d;%d;%dm%c\x1b[0m", avgR, avgG, avgB, ch))
			} else {
				sb.WriteRune(ch)
			}
		}
		sb.WriteByte('\n')
	}

	fmt.Print(sb.String())
}

func applyFloydSteinberg(lum [][]float64, w, h int) {
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			old := lum[y][x]
			var newVal float64
			if old >= 128.0 {
				newVal = 255.0
			} else {
				newVal = 0.0
			}
			lum[y][x] = newVal
			err := old - newVal

			if x+1 < w {
				lum[y][x+1] += err * 7.0 / 16.0
			}
			if y+1 < h {
				if x-1 >= 0 {
					lum[y+1][x-1] += err * 3.0 / 16.0
				}
				lum[y+1][x] += err * 5.0 / 16.0
				if x+1 < w {
					lum[y+1][x+1] += err * 1.0 / 16.0
				}
			}
		}
	}
}
