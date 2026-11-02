// Moves the pointer for live end-to-end tests: warp-cursor x y [x y ...] with ~16 ms between points.
import CoreGraphics
import Foundation
let args = CommandLine.arguments.dropFirst().compactMap { Double($0) }
var i = 0
while i + 1 < args.count {
  CGWarpMouseCursorPosition(CGPoint(x: args[i], y: args[i + 1]))
  usleep(16000)
  i += 2
}
