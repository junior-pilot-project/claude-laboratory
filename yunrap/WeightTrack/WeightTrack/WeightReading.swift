import Foundation

struct WeightReading: Identifiable, Equatable {
    let id = UUID()
    let weight: Double
    let isStabilized: Bool
    let timestamp: Date

    var formattedWeight: String {
        String(format: "%.1f", weight)
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: timestamp)
    }
}
