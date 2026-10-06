import Cocoa
import WebKit

final class WebSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }

    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "woff2": return "font/woff2"
        case "webp": return "image/webp"
        default: return "application/octet-stream"
        }
    }

    private let queue = DispatchQueue(label: "cow.files", qos: .userInitiated, attributes: .concurrent)
    private let cache = NSCache<NSString, NSData>()
    private var stopped = Set<ObjectIdentifier>()
    private let lock = NSLock()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { task.didFailWithError(URLError(.badURL)); return }
        var path = url.path.removingPercentEncoding ?? url.path
        if path.isEmpty || path == "/" { path = "/cabinet-of-war.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        let id = ObjectIdentifier(task as AnyObject)
        queue.async { [weak self] in
            guard let self = self else { return }
            var status = 200
            var data = Data()
            let key = file.path as NSString
            if let c = self.cache.object(forKey: key) {
                data = c as Data
            } else if file.path.hasPrefix(self.root.path), let d = try? Data(contentsOf: file, options: .mappedIfSafe) {
                data = d
                if d.count < 400_000 { self.cache.setObject(d as NSData, forKey: key) }
            } else {
                status = 404
            }
            let headers = [
                "Content-Type": self.mime(file.pathExtension),
                "Content-Length": "\(data.count)",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "max-age=86400",
            ]
            let resp = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
            DispatchQueue.main.async {
                self.lock.lock(); let gone = self.stopped.remove(id) != nil; self.lock.unlock()
                if gone { return }
                task.didReceive(resp)
                task.didReceive(data)
                task.didFinish()
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        lock.lock(); stopped.insert(ObjectIdentifier(task as AnyObject)); lock.unlock()
    }

}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMenu()

        let cfg = WKWebViewConfiguration()
        let webRoot: URL
        if let dev = ProcessInfo.processInfo.environment["COW_WEB_ROOT"] {
            webRoot = URL(fileURLWithPath: dev)
        } else {
            webRoot = Bundle.main.resourceURL!.appendingPathComponent("web")
        }
        cfg.setURLSchemeHandler(WebSchemeHandler(root: webRoot), forURLScheme: "cow")
        cfg.userContentController.add(self, name: "clip")

        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        let style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1500, height: 940), styleMask: style, backing: .buffered, defer: false)
        window.title = "Cabinet of War"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.102, green: 0.078, blue: 0.067, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 1000, height: 640)
        window.contentView = webView
        window.delegate = self
        window.setFrameAutosaveName("CabinetOfWarMain")
        if !window.setFrameUsingName("CabinetOfWarMain") { window.center() }
        let onScreen = NSScreen.screens.contains { $0.visibleFrame.intersects(window.frame.insetBy(dx: 40, dy: 40)) }
        if !onScreen || window.frame.width < 600 { window.setContentSize(NSSize(width: 1500, height: 940)); window.center() }
        window.makeKeyAndOrderFront(nil)

        webView.load(URLRequest(url: URL(string: "cow://app/cabinet-of-war.html")!))
        NSApp.activate(ignoringOtherApps: true)
    }

    // web process killed by the system (memory): reload instead of leaving a blank window
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: URL(string: "cow://app/cabinet-of-war.html")!))
    }

    func showError(_ message: String) {
        let esc = message.replacingOccurrences(of: "<", with: "&lt;")
        let html = "<body style='background:#1a1411;color:#eadfc6;font:18px Georgia;padding:60px'><h1>Cabinet of War could not load</h1><p>\(esc)</p><p>Try View → Reload (⌘R). If it keeps happening, rebuild the app with build_app.sh.</p></body>"
        webView.loadHTMLString(html, baseURL: nil)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showError(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showError(error.localizedDescription) }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // JS → native clipboard (file/custom schemes are not secure contexts for navigator.clipboard)
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "clip", let s = message.body as? String {
            let pb = NSPasteboard.general
            pb.clearContents()
            pb.setString(s, forType: .string)
        }
    }

    // external links open in the default browser
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download, preferences); return }
        if let url = action.request.url, let scheme = url.scheme, scheme.hasPrefix("http"), action.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel, preferences)
            return
        }
        decisionHandler(.allow, preferences)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.begin { r in completionHandler(r == .OK ? panel.url : nil) }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.begin { r in completionHandler(r == .OK ? panel.urls : nil) }
    }

    @objc func zoomIn() { webView.pageZoom = min(2.0, webView.pageZoom + 0.1) }
    @objc func zoomOut() { webView.pageZoom = max(0.5, webView.pageZoom - 0.1) }
    @objc func zoomReset() { webView.pageZoom = 1.0 }
    @objc func reload() { webView.reload() }

    func buildMenu() {
        let main = NSMenu()
        func add(_ title: String, _ items: [NSMenuItem]) {
            let item = NSMenuItem(); main.addItem(item)
            let m = NSMenu(title: title); items.forEach { m.addItem($0) }; item.submenu = m
        }
        func mi(_ t: String, _ sel: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: sel, keyEquivalent: key); i.keyEquivalentModifierMask = mods; return i
        }
        add("Cabinet of War", [
            mi("About Cabinet of War", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            mi("Hide Cabinet of War", #selector(NSApplication.hide(_:)), "h"),
            .separator(),
            mi("Quit Cabinet of War", #selector(NSApplication.terminate(_:)), "q"),
        ])
        add("Edit", [
            mi("Undo", Selector(("undo:")), "z"),
            mi("Redo", Selector(("redo:")), "Z", [.command, .shift]),
            .separator(),
            mi("Cut", #selector(NSText.cut(_:)), "x"),
            mi("Copy", #selector(NSText.copy(_:)), "c"),
            mi("Paste", #selector(NSText.paste(_:)), "v"),
            mi("Select All", #selector(NSText.selectAll(_:)), "a"),
        ])
        let v = [mi("Zoom In", #selector(zoomIn), "+"), mi("Zoom Out", #selector(zoomOut), "-"), mi("Actual Size", #selector(zoomReset), "0"), .separator(), mi("Reload", #selector(reload), "r"), mi("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control])]
        v.forEach { $0.target = self }
        v.last?.target = nil
        add("View", v)
        add("Window", [mi("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"), mi("Zoom", #selector(NSWindow.performZoom(_:)))])
        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
