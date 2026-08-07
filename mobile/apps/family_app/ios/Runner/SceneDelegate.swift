import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  private let privacyCoverTag = 0x4F5A5A59

  override func sceneWillResignActive(_ scene: UIScene) {
    super.sceneWillResignActive(scene)
    setPrivacyCover(on: scene, visible: true)
  }

  override func sceneDidBecomeActive(_ scene: UIScene) {
    super.sceneDidBecomeActive(scene)
    setPrivacyCover(on: scene, visible: false)
  }

  private func setPrivacyCover(on scene: UIScene, visible: Bool) {
    guard let windowScene = scene as? UIWindowScene else { return }
    for window in windowScene.windows {
      if visible {
        guard window.viewWithTag(privacyCoverTag) == nil else { continue }
        let cover = UIView(frame: window.bounds)
        cover.tag = privacyCoverTag
        cover.backgroundColor = .systemBackground
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.isAccessibilityElement = false
        cover.accessibilityElementsHidden = true
        window.addSubview(cover)
      } else {
        window.viewWithTag(privacyCoverTag)?.removeFromSuperview()
      }
    }
  }
}
