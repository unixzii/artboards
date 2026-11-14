import { Column, Ellipse, Frame, Rect, Row, Text } from "artboards";

const NAV = ["Overview", "Artboards", "组件库", "Settings"];

export default function Page1() {
  return (
    <Frame width={960} height={600} fill="#ffffff">
      <Row width="fill" height="fill" align="stretch">
        <Column name="sidebar" width={240} padding={[16, 12]} gap={4} fill="#f6f7f6" align="stretch">
          <Text fontSize={12} fontWeight={600} color="#6b7280">
            WORKSPACE
          </Text>
          {NAV.map((label, i) => (
            <ListItem key={label} label={label} active={i === 1} />
          ))}
        </Column>
        <Column name="content" width="fill" padding={32} gap={16} align="stretch">
          <Text fontSize={28} fontWeight={700}>
            Artboards 渲染内核 spike
          </Text>
          <Text width="fill" fontSize={15} lineHeight={24} color="#4b5563">
            This paragraph has width="fill", so it wraps inside the content column. Text measurement goes
            through Taffy's measure callback into a Skia paragraph, 中英文混排也走同一条路径。
          </Text>
          <Row gap={12} height={120} align="stretch">
            <Card title="Fixed" width={160} />
            <Card title="Fill" width="fill" />
            <Card title="Fill" width="fill" />
          </Row>
          <Rect height="fill" fill="#f0f0f0" cornerRadius={12} />
        </Column>
      </Row>
    </Frame>
  );
}

function ListItem({ label, active }) {
  return (
    <Row height={36} padding={[0, 10]} gap={8} align="center" justify="space-between" cornerRadius={8} fill={active ? "#e3ebe7" : undefined}>
      <Text color={active ? "#2D5A4A" : "#111827"}>{label}</Text>
      {active && <Ellipse width={6} height={6} fill="#2D5A4A" />}
    </Row>
  );
}

function Card({ title, width }) {
  return (
    <Column width={width} padding={16} gap={6} cornerRadius={12} stroke="#d1d5db" justify="end">
      <Text fontSize={13} color="#6b7280">
        width
      </Text>
      <Text fontSize={18} fontWeight={600}>
        {title}
      </Text>
    </Column>
  );
}
