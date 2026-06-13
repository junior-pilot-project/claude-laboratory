import SwiftUI

struct ContentView: View {
    @StateObject private var bluetooth = BluetoothManager()

    var body: some View {
        TabView {
            liveTab
                .tabItem {
                    Label("측정", systemImage: "scalemass")
                }

            MonthlyView(bluetooth: bluetooth)
                .tabItem {
                    Label("기록", systemImage: "calendar")
                }
        }
        .preferredColorScheme(.dark)
    }

    private var liveTab: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                    .padding(.top, 20)

                Spacer()
                weightDisplay
                Spacer()

                statusBar
                    .padding(.bottom, 12)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 4) {
            Text("WeightTrack")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text("샤오미 체중계 직접 연결")
                .font(.caption)
                .foregroundColor(.gray)
        }
    }

    // MARK: - Weight Display

    private var weightDisplay: some View {
        ZStack {
            // Outer pulse ring
            Circle()
                .stroke(ringColor.opacity(0.15), lineWidth: 2)
                .frame(width: 280, height: 280)
                .scaleEffect(bluetooth.liveReading != nil ? 1.08 : 1.0)
                .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true),
                           value: bluetooth.liveReading != nil)

            // Main ring
            Circle()
                .stroke(ringColor, lineWidth: 4)
                .frame(width: 260, height: 260)
                .animation(.easeInOut(duration: 0.4), value: ringColor)

            VStack(spacing: 8) {
                weightText
                unitText

                if let reading = bluetooth.liveReading, reading.isStabilized {
                    stableLabel
                }
            }
        }
    }

    private var weightText: some View {
        Group {
            if let reading = bluetooth.liveReading {
                Text(reading.formattedWeight)
                    .font(.system(size: 80, weight: .ultraLight, design: .rounded))
                    .foregroundColor(.white)
                    .contentTransition(.numericText(countsDown: false))
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: reading.weight)
            } else {
                Text("--.-")
                    .font(.system(size: 80, weight: .ultraLight, design: .rounded))
                    .foregroundColor(.gray.opacity(0.4))
            }
        }
    }

    private var unitText: some View {
        Text("kg")
            .font(.system(size: 24, weight: .light, design: .rounded))
            .foregroundColor(bluetooth.liveReading != nil ? .white.opacity(0.7) : .gray.opacity(0.3))
    }

    private var stableLabel: some View {
        Text("확정")
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.green)
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            .background(Color.green.opacity(0.18))
            .clipShape(Capsule())
            .transition(.scale.combined(with: .opacity))
    }

    private var ringColor: Color {
        guard let reading = bluetooth.liveReading else { return Color.gray.opacity(0.3) }
        return reading.isStabilized ? .green : .blue
    }

    // MARK: - Status Bar

    private var statusBar: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(bluetooth.isScanning ? Color.green : Color.red)
                .frame(width: 7, height: 7)

            Text(statusText)
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.05))
        .clipShape(Capsule())
    }

    private var statusText: String {
        switch bluetooth.bluetoothState {
        case .poweredOff: return "블루투스 꺼짐"
        case .unauthorized: return "블루투스 권한 없음"
        case .poweredOn:
            if bluetooth.liveReading != nil {
                return "체중계 신호 수신 중"
            }
            return "체중계 대기 중... (올라서세요)"
        default: return "초기화 중..."
        }
    }

}

// MARK: - History Row (unused, kept for reference)

struct HistoryRow: View {
    let reading: WeightReading

    var body: some View {
        HStack {
            Text(reading.formattedWeight + " kg")
                .font(.system(size: 17, weight: .medium, design: .rounded))
                .foregroundColor(.white)

            Spacer()

            Text(reading.formattedTime)
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}

#Preview {
    ContentView()
}
