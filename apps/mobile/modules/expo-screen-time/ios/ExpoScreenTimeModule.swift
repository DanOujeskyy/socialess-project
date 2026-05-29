import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI

// ── SwiftUI picker sheet ───────────────────────────────────────────────────────

@available(iOS 16.0, *)
private struct ActivityPickerWrapper: View {
  @State private var selection: FamilyActivitySelection
  let onDone: (FamilyActivitySelection) -> Void
  let onCancel: () -> Void

  init(
    initial: FamilyActivitySelection = FamilyActivitySelection(),
    onDone: @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void
  ) {
    _selection = State(initialValue: initial)
    self.onDone = onDone
    self.onCancel = onCancel
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Vyber aplikace k blokování")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Zrušit") { onCancel() }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Hotovo") { onDone(selection) }
              .fontWeight(.semibold)
          }
        }
    }
  }
}

// ── Expo module ────────────────────────────────────────────────────────────────

public class ExpoScreenTimeModule: Module {

  private static let selectionKey = "ExpoScreenTime.selection"

  public func definition() -> ModuleDefinition {
    Name("ExpoScreenTime")

    // ── requestAuthorization ─────────────────────────────────────────────────
    // Shows the iOS system prompt asking the user to allow this app to manage
    // Screen Time restrictions. Must be called before blockApps() will work.
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("UNSUPPORTED", "Screen Time requires iOS 16+")
        return
      }
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve("approved")
        } catch {
          promise.reject("DENIED", error.localizedDescription)
        }
      }
    }

    // ── getAuthorizationStatus ───────────────────────────────────────────────
    Function("getAuthorizationStatus") { () -> String in
      guard #available(iOS 16.0, *) else { return "unsupported" }
      switch AuthorizationCenter.shared.authorizationStatus {
      case .approved:      return "approved"
      case .denied:        return "denied"
      case .notDetermined: return "notDetermined"
      @unknown default:    return "notDetermined"
      }
    }

    // ── presentAppPicker ─────────────────────────────────────────────────────
    // Opens the system FamilyActivityPicker so the user can select which apps
    // to block. The selection is persisted in UserDefaults.
    // Returns true if the user tapped Done, false if they cancelled.
    AsyncFunction("presentAppPicker") { (promise: Promise) in
      guard #available(iOS 16.0, *) else {
        promise.reject("UNSUPPORTED", "Screen Time requires iOS 16+")
        return
      }
      DispatchQueue.main.async {
        guard
          let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let root  = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else {
          promise.reject("NO_VC", "Root view controller not found")
          return
        }

        // Find the topmost presented controller
        var top = root
        while let presented = top.presentedViewController { top = presented }

        // Load saved selection as starting point
        var initial = FamilyActivitySelection()
        if let data = UserDefaults.standard.data(forKey: Self.selectionKey),
           let saved = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
          initial = saved
        }

        let pickerView = ActivityPickerWrapper(
          initial: initial,
          onDone: { selection in
            if let data = try? JSONEncoder().encode(selection) {
              UserDefaults.standard.set(data, forKey: Self.selectionKey)
            }
            top.dismiss(animated: true) { promise.resolve(true) }
          },
          onCancel: {
            top.dismiss(animated: true) { promise.resolve(false) }
          }
        )

        let hostingVC = UIHostingController(rootView: pickerView)
        hostingVC.modalPresentationStyle = .formSheet
        top.present(hostingVC, animated: true)
      }
    }

    // ── blockApps ────────────────────────────────────────────────────────────
    // Applies a system-level block on all apps the user previously selected.
    // iOS shows a "Screen Time" lock screen when they try to open those apps.
    // Returns false if no selection has been saved yet.
    Function("blockApps") { () -> Bool in
      guard #available(iOS 16.0, *) else { return false }
      guard
        let data      = UserDefaults.standard.data(forKey: Self.selectionKey),
        let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
      else { return false }

      let tokens = selection.applicationTokens
      guard !tokens.isEmpty else { return false }

      let store = ManagedSettingsStore()
      store.application.blockedApplications = tokens
      return true
    }

    // ── unblockApps ──────────────────────────────────────────────────────────
    // Removes all Screen Time restrictions applied by this app.
    Function("unblockApps") {
      guard #available(iOS 16.0, *) else { return }
      ManagedSettingsStore().clearAllSettings()
    }

    // ── isBlocked ────────────────────────────────────────────────────────────
    Function("isBlocked") { () -> Bool in
      guard #available(iOS 16.0, *) else { return false }
      let blocked = ManagedSettingsStore().application.blockedApplications
      return blocked != nil && !blocked!.isEmpty
    }

    // ── hasSelection ─────────────────────────────────────────────────────────
    Function("hasSelection") { () -> Bool in
      UserDefaults.standard.data(forKey: Self.selectionKey) != nil
    }
  }
}
