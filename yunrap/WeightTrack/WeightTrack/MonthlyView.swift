import SwiftUI

struct MonthlyView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var displayMonth: Date = Date()

    private let calendar = Calendar.current

    private var monthReadings: [Int: WeightReading] {
        let comps = calendar.dateComponents([.year, .month], from: displayMonth)
        var result: [Int: WeightReading] = [:]
        for reading in bluetooth.history {
            let r = calendar.dateComponents([.year, .month, .day], from: reading.timestamp)
            if r.year == comps.year && r.month == comps.month, let day = r.day {
                if result[day] == nil { result[day] = reading }
            }
        }
        return result
    }

    private var daysInMonth: Int {
        calendar.range(of: .day, in: .month, for: displayMonth)?.count ?? 30
    }

    private var firstWeekday: Int {
        var comps = calendar.dateComponents([.year, .month], from: displayMonth)
        comps.day = 1
        let firstDay = calendar.date(from: comps)!
        return calendar.component(.weekday, from: firstDay) - 1
    }

    private var monthTitle: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy년 M월"
        f.locale = Locale(identifier: "ko_KR")
        return f.string(from: displayMonth)
    }

    private var isCurrentMonth: Bool {
        let now = calendar.dateComponents([.year, .month], from: Date())
        let cur = calendar.dateComponents([.year, .month], from: displayMonth)
        return now.year == cur.year && now.month == cur.month
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                navigationHeader
                    .padding(.top, 8)

                weekdayHeader
                    .padding(.top, 12)
                    .padding(.bottom, 8)

                calendarGrid

                if !monthReadings.isEmpty {
                    monthSummary
                        .padding(.top, 20)
                        .padding(.horizontal, 16)
                }

                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }

    private var navigationHeader: some View {
        HStack {
            Button(action: { changeMonth(-1) }) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
            }

            Spacer()

            Text(monthTitle)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.white)

            Spacer()

            Button(action: { changeMonth(1) }) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(isCurrentMonth ? .gray.opacity(0.3) : .white)
                    .frame(width: 44, height: 44)
            }
            .disabled(isCurrentMonth)
        }
        .padding(.horizontal, 8)
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(["일", "월", "화", "수", "목", "금", "토"], id: \.self) { day in
                Text(day)
                    .font(.caption2)
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 8)
    }

    private var calendarGrid: some View {
        let rows = Int(ceil(Double(firstWeekday + daysInMonth) / 7.0))
        let today = calendar.component(.day, from: Date())

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7),
            spacing: 6
        ) {
            ForEach(0..<rows * 7, id: \.self) { index in
                let day = index - firstWeekday + 1
                if day < 1 || day > daysInMonth {
                    Color.clear.frame(height: 60)
                } else {
                    dayCell(day: day, reading: monthReadings[day], isToday: isCurrentMonth && day == today)
                }
            }
        }
        .padding(.horizontal, 8)
    }

    private func dayCell(day: Int, reading: WeightReading?, isToday: Bool) -> some View {
        VStack(spacing: 3) {
            Text("\(day)")
                .font(.system(size: 13, weight: isToday ? .bold : reading != nil ? .semibold : .regular))
                .foregroundColor(isToday ? .blue : reading != nil ? .white : .gray.opacity(0.4))

            if let reading = reading {
                Text(reading.formattedWeight)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundColor(.green)
            } else {
                Spacer().frame(height: 13)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 60)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(reading != nil ? Color.green.opacity(0.12) : Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(isToday ? Color.blue.opacity(0.5) : Color.clear, lineWidth: 1)
                )
        )
    }

    private var monthSummary: some View {
        let weights = monthReadings.values.map(\.weight)
        let avg = weights.reduce(0, +) / Double(weights.count)
        let min = weights.min() ?? 0
        let max = weights.max() ?? 0

        return HStack(spacing: 0) {
            summaryCell(label: "최저", value: String(format: "%.1f", min), color: .blue)
            Divider().background(Color.white.opacity(0.1)).frame(height: 36)
            summaryCell(label: "평균", value: String(format: "%.1f", avg), color: .gray)
            Divider().background(Color.white.opacity(0.1)).frame(height: 36)
            summaryCell(label: "최고", value: String(format: "%.1f", max), color: .orange)
        }
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func summaryCell(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 17, weight: .semibold, design: .rounded))
                .foregroundColor(color)
            Text("kg")
                .font(.caption2)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    private func changeMonth(_ value: Int) {
        displayMonth = calendar.date(byAdding: .month, value: value, to: displayMonth) ?? displayMonth
    }
}
