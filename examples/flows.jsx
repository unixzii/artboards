import { Column, Ellipse, Frame, Rect, Row, Text } from "artboards";

const INK = "#111827";
const MUTED = "#6b7280";
const BRAND = "#2D5A4A";

export function SignIn() {
  return (
    <Frame width={390} height={844} fill="#ffffff">
      <Column width="fill" height="fill" padding={[96, 24, 32, 24]} gap={24} align="stretch">
        <Column gap={8}>
          <Text fontSize={28} fontWeight={700} color={INK}>欢迎回来</Text>
          <Text fontSize={15} color={MUTED}>Sign in to continue to Artboards</Text>
        </Column>
        <Column gap={12} align="stretch">
          <Field label="Email" value="you@example.com" />
          <Field label="Password" value="••••••••" />
        </Column>
        <Row height={48} align="center" justify="center" fill={BRAND} cornerRadius={12}>
          <Text fontSize={16} fontWeight={600} color="#ffffff">Sign in</Text>
        </Row>
        <Rect height="fill" />
        <Text width="fill" textAlign="center" fontSize={13} color="#c4c8cf">By continuing you agree to the terms.</Text>
      </Column>
    </Frame>
  );
}

export function Inbox() {
  const rows = ["设计评审", "Weekly sync", "Release notes", "Onboarding"];
  return (
    <Frame width={390} height={844} fill="#f6f7f6">
      <Column width="fill" height="fill" align="stretch">
        <Row height={96} padding={[48, 20, 0, 20]} align="center" justify="space-between" fill="#ffffff">
          <Text fontSize={22} fontWeight={700} color={INK}>Inbox</Text>
          <Ellipse width={32} height={32} fill={BRAND} />
        </Row>
        <Column padding={16} gap={10} align="stretch">
          {rows.map((title, i) => (
            <Row key={title} padding={16} gap={12} align="center" fill="#ffffff" cornerRadius={14}>
              <Ellipse width={10} height={10} fill={i < 2 ? BRAND : "#d1d5db"} />
              <Column width="fill" gap={2}>
                <Text fontSize={15} fontWeight={600} color={INK}>{title}</Text>
                <Text fontSize={13} color={MUTED}>Updated {i + 1}h ago</Text>
              </Column>
              <Text fontSize={13} color={MUTED}>›</Text>
            </Row>
          ))}
        </Column>
      </Column>
    </Frame>
  );
}

export function Broken() {
  const user = null;
  return (
    <Frame width={390} height={300}>
      <Text>{user.name}</Text>
    </Frame>
  );
}

function Field({ label, value }) {
  return (
    <Column gap={6} align="stretch">
      <Text fontSize={13} fontWeight={500} color={MUTED}>{label}</Text>
      <Row height={48} padding={[0, 14]} align="center" stroke="#d1d5db" cornerRadius={12}>
        <Text fontSize={15} color={INK}>{value}</Text>
      </Row>
    </Column>
  );
}
