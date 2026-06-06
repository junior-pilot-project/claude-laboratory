const { formatMessage } = require('../src/notify/format');

describe('formatMessage', () => {
  it('고속버스 메시지를 올바르게 포맷한다', () => {
    const route = { from: '서울', to: '부산', date: '2026-06-10' };
    const seats = [{ time: '09:30', count: 2 }];
    const msg = formatMessage('kobus', route, seats);

    expect(msg).toContain('🎉 취소표 발견!');
    expect(msg).toContain('[고속버스] 서울 → 부산');
    expect(msg).toContain('날짜: 2026-06-10');
    expect(msg).toContain('시간: 09:30 출발');
    expect(msg).toContain('잔여석: 2석');
  });

  it('시외버스는 [시외버스]로 표시한다', () => {
    const route = { from: '서울', to: '강릉', date: '2026-06-10' };
    const msg = formatMessage('bustago', route, [{ time: '10:00', count: 1 }]);
    expect(msg).toContain('[시외버스]');
  });

  it('KTX는 [KTX]로 표시한다', () => {
    const route = { from: '서울', to: '부산', date: '2026-06-10' };
    const msg = formatMessage('korail', route, [{ time: '11:00', count: 3 }]);
    expect(msg).toContain('[KTX]');
  });

  it('여러 좌석을 모두 나열한다', () => {
    const route = { from: '서울', to: '대전', date: '2026-06-10' };
    const seats = [{ time: '09:00', count: 1 }, { time: '11:00', count: 2 }];
    const msg = formatMessage('kobus', route, seats);
    expect(msg).toContain('09:00');
    expect(msg).toContain('11:00');
  });
});
