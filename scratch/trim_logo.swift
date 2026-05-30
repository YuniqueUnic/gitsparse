import AppKit
import CoreGraphics

// MARK: - 交互式裁剪视图
class CropView: NSView {
    var image: NSImage?
    var cgImage: CGImage? // 增加对原始 CGImage 的引用
    var startPoint: NSPoint?
    var currentRect: NSRect = .zero
    var onCropConfirmed: ((NSRect) -> Void)?

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        image?.draw(in: self.bounds)
        
        // 绘制半透明遮罩
        NSColor.black.withAlphaComponent(0.6).set()
        let path = NSBezierPath(rect: self.bounds)
        if currentRect != .zero {
            path.append(NSBezierPath(rect: currentRect).reversed)
        }
        path.fill()
        
        // 绘制白色边框
        if currentRect != .zero {
            NSColor.white.set()
            let strokePath = NSBezierPath(rect: currentRect)
            strokePath.lineWidth = 2
            strokePath.stroke()
        }
    }

    override func mouseDown(with event: NSEvent) {
        startPoint = convert(event.locationInWindow, from: nil)
    }

    override func mouseDragged(with event: NSEvent) {
        guard let start = startPoint else { return }
        let current = convert(event.locationInWindow, from: nil)
        
        // 强制 1:1 正方形
        let diffX = current.x - start.x
        let diffY = current.y - start.y
        let side = max(abs(diffX), abs(diffY))
        
        currentRect = NSRect(
            x: diffX > 0 ? start.x : start.x - side,
            y: diffY > 0 ? start.y : start.y - side,
            width: side,
            height: side
        )
        needsDisplay = true
    }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 36 { // Enter
            onCropConfirmed?(currentRect)
        } else if event.keyCode == 53 { // ESC
            NSApp.terminate(nil)
        }
    }
    
    override var acceptsFirstResponder: Bool { true }
}

// MARK: - 程序入口
func runCropper(inputPath: String, outputPath: String) {
    let app = NSApplication.shared
    app.setActivationPolicy(.regular)

    guard let img = NSImage(contentsOfFile: inputPath),
          let cgImage = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("❌ 错误: 无法加载图片")
        return
    }

    // 计算窗口展示尺寸 (适配屏幕)
    let screenSize = NSScreen.main?.frame.size ?? NSSize(width: 1000, height: 1000)
    let maxW = screenSize.width * 0.8
    let maxH = screenSize.height * 0.8
    let scale = min(maxW / img.size.width, maxH / img.size.height, 1.0)
    let winSize = NSSize(width: img.size.width * scale, height: img.size.height * scale)

    let window = NSWindow(
        contentRect: NSRect(origin: .zero, size: winSize),
        styleMask: [.titled, .closable],
        backing: .buffered,
        defer: false
    )
    window.center()
    window.title = "框选完成后请按「回车」确认保存"
    window.makeKeyAndOrderFront(nil)

    let cropView = CropView(frame: window.contentView!.bounds)
    cropView.image = img
    cropView.cgImage = cgImage
    window.contentView?.addSubview(cropView)
    window.makeFirstResponder(cropView)

    cropView.onCropConfirmed = { rect in
        // 关键修复 1：计算视图点到原始像素的比例 (必须使用 cgImage 的宽高以应对 Retina)
        let xRatio = CGFloat(cgImage.width) / winSize.width
        let yRatio = CGFloat(cgImage.height) / winSize.height
        
        // 关键修复 2：坐标轴翻转
        // NSView 的 y 是从底部算的，CGImage.cropping 的 y 是从顶部算的
        let cropX = rect.origin.x * xRatio
        let cropY = (winSize.height - (rect.origin.y + rect.size.height)) * yRatio
        let cropW = rect.size.width * xRatio
        let cropH = rect.size.height * yRatio

        let pixelRect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)

        if let croppedCG = cgImage.cropping(to: pixelRect) {
            // 准备 256x256 画布
            let targetSize = 256
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            guard let context = CGContext(
                data: nil,
                width: targetSize,
                height: targetSize,
                bitsPerComponent: 8,
                bytesPerRow: targetSize * 4,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return }

            context.interpolationQuality = .high
            context.draw(croppedCG, in: CGRect(x: 0, y: 0, width: targetSize, height: targetSize))

            if let finalImage = context.makeImage() {
                let rep = NSBitmapImageRep(cgImage: finalImage)
                if let data = rep.representation(using: .png, properties: [:]) {
                    try? data.write(to: URL(fileURLWithPath: outputPath))
                    print("✅ 裁剪成功！已保存到: \(outputPath)")
                }
            }
        }
        NSApp.terminate(nil)
    }

    NSApp.activate(ignoringOtherApps: true)
    app.run()
}

// 路径配置
let currentDir = FileManager.default.currentDirectoryPath
runCropper(
    inputPath: "\(currentDir)/gitsparse.png",
    outputPath: "\(currentDir)/public/logo.png"
)