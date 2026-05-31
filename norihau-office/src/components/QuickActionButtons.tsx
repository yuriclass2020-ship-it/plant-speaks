const quickActions = [
  "관찰기록 문장 만들기",
  "개발 요청문 생성",
  "인스타 캡션 작성",
  "오늘 할 일 정리",
];

export default function QuickActionButtons({ onSelect }: { onSelect: (command: string) => void }) {
  return (
    <div className="quick-actions">
      {quickActions.map((action) => (
        <button key={action} onClick={() => onSelect(action)}>
          {action}
        </button>
      ))}
    </div>
  );
}
