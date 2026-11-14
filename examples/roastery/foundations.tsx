// Design foundations: tokens and every component state on one board.
import { Column, Grid, Rect, Row, Span, Text } from "artboards";
import { Avatar, Badge, Button, Chip, Icon, Input, Price, ProgressBar, Segmented, Stepper } from "./components.tsx";
import type { ReactNode } from "react";
import type { ButtonVariant } from "./components.tsx";
import { ICONS, type IconName } from "./icons.ts";
import { color, font, radius, type } from "./tokens.ts";

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Column width="fill" gap={20} padding={[32, 0, 0, 0]} stroke={color.oat} strokeWidth={[1, 0, 0, 0]} strokeAlign="inside" align="stretch">
      <Row align="end" gap={12}>
        <Text fontFamily={font.display} fontSize={26} fontWeight={600} color={color.espresso}>{title}</Text>
        {note && <Text fontSize={13} color={color.muted}>{note}</Text>}
      </Row>
      {children}
    </Column>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <Text fontFamily={font.mono} fontSize={11} color={color.muted}>{children}</Text>;
}

const SWATCHES = [
  ["espresso", "Text"],
  ["roast", "Brand"],
  ["caramel", "Accent"],
  ["caramelSoft", "Accent tint"],
  ["crema", "Background"],
  ["foam", "Surface"],
  ["oat", "Hairline"],
  ["muted", "Secondary text"],
  ["sage", "Success"],
  ["amber", "Warning"],
  ["tomato", "Danger"],
  ["sky", "Info"],
];

export function Foundations() {
  return (
    <Column name="Foundations" width={1200} padding={56} gap={36} fill={color.foam} align="stretch">
      <Row align="end" justify="space-between">
        <Column gap={6}>
          <Text fontSize={12} fontWeight={700} letterSpacing={2.4} color={color.caramelText}>ROASTERY DESIGN SYSTEM</Text>
          <Text fontFamily={font.display} fontSize={56} fontWeight={600} color={color.espresso}>
            焙刻 <Accent>Roastery</Accent>
          </Text>
        </Column>
        <Text width={420} fontSize={14} lineHeight={22} color={color.muted} textAlign="right">
          One vocabulary for the customer app, the barista board and the manager console. Warm neutrals carry the brand; colour is reserved for state.
        </Text>
      </Row>

      <Section title="Colour" note="12 tokens · contrast-checked against crema and white">
        <Grid columns={6} gap={16}>
          {SWATCHES.map(([key, role]) => (
            <Column key={key} gap={8} align="stretch">
              <Rect width="fill" height={72} cornerRadius={radius.md} fill={color[key]} stroke="rgba(43, 26, 18, 0.08)" strokeAlign="inside" />
              <Column gap={2}>
                <Text fontSize={13} fontWeight={600} color={color.espresso}>{role}</Text>
                <Label>{`${key} · ${color[key]}`}</Label>
              </Column>
            </Column>
          ))}
        </Grid>
      </Section>

      <Section title="Type" note="Fraunces for moments, Inter for reading, JetBrains Mono for codes">
        <Grid columns={["1fr", "1fr"]} gap={40}>
          <Column gap={14} align="stretch">
            {Object.entries(type).reverse().map(([k, [size, lh]]) => (
              <Row key={k} gap={16} align="center">
                <Text width={110} fontFamily={font.mono} fontSize={11} color={color.muted}>{`${k} ${size}/${lh}`}</Text>
                <Text width="fill" maxLines={1} fontSize={size} lineHeight={lh} fontWeight={size >= 20 ? 700 : 400} color={color.espresso}>
                  {size >= 32 ? "早安，咖啡" : "一杯好咖啡，从新鲜烘焙开始"}
                </Text>
              </Row>
            ))}
          </Column>
          <Column gap={16} align="stretch">
            <Column padding={24} gap={4} cornerRadius={radius.lg} fill={color.crema}>
              <Label>Fraunces · display</Label>
              <Text fontFamily={font.display} fontSize={40} fontWeight={600} color={color.roast}>
                Slow roasted, <Accent>freshly</Accent> poured.
              </Text>
            </Column>
            <Column padding={24} gap={4} cornerRadius={radius.lg} fill={color.crema}>
              <Label>Inter · body · tabular numbers</Label>
              <Text fontSize={15} lineHeight={22} color={color.espresso}>
                今日营业额 <Span fontWeight={700} tabularNums>¥18,240.00</Span>，较上周同期 <Span color={color.sage} fontWeight={600}>+12.4%</Span>
              </Text>
            </Column>
            <Column padding={24} gap={4} cornerRadius={radius.lg} fill={color.espresso}>
              <Text fontFamily={font.mono} fontSize={11} color={color.oatStrong}>JetBrains Mono · order codes</Text>
              <Text fontFamily={font.mono} fontSize={34} fontWeight={700} letterSpacing={2} color={color.foam}>A-2048</Text>
            </Column>
          </Column>
        </Grid>
      </Section>

      <Section title="Buttons" note="variant × state">
        <Grid columns={[110, "1fr", "1fr", "1fr", "1fr"]} rowGap={16} columnGap={20} align="center">
          <Label> </Label>
          <Label>default</Label>
          <Label>pressed</Label>
          <Label>disabled</Label>
          <Label>with icon · small</Label>
          {(["primary", "secondary", "outline", "ghost", "danger"] as ButtonVariant[]).map((v) => [
            <Label key={`${v}-l`}>{v}</Label>,
            <Button key={`${v}-d`} variant={v}>加入购物车</Button>,
            <Button key={`${v}-p`} variant={v} pressed>加入购物车</Button>,
            <Button key={`${v}-x`} variant={v} disabled>加入购物车</Button>,
            <Row key={`${v}-i`} gap={8}>
              <Button variant={v} icon="shoppingBag">结算</Button>
              <Button variant={v} size="sm">小按钮</Button>
            </Row>,
          ])}
        </Grid>
      </Section>

      <Section title="Controls">
        <Grid columns={3} gap={32}>
          <Column gap={12} align="stretch">
            <Label>Chip · default / selected / icon</Label>
            <Row gap={8} wrap crossGap={8}>
              <Chip>推荐</Chip>
              <Chip selected>拿铁</Chip>
              <Chip icon="snowflake">冰饮</Chip>
              <Chip icon="flame" size="sm">热饮</Chip>
            </Row>
            <Label>Segmented</Label>
            <Segmented options={["中杯", "大杯", "超大杯"]} value="大杯" />
            <Label>Stepper · regular / compact</Label>
            <Row gap={24} align="center">
              <Stepper value={2} />
              <Stepper value={1} compact />
            </Row>
          </Column>
          <Column gap={12} align="stretch">
            <Label>Input · default / focus / error</Label>
            <Input placeholder="搜索饮品、甜点" icon="search" />
            <Input label="手机号" value="138 0013 8000" state="focus" />
            <Input label="优惠码" value="AUTUMN2O" state="error" hint="优惠码不存在或已过期" />
          </Column>
          <Column gap={12} align="stretch">
            <Label>Badge · tone</Label>
            <Row gap={6} wrap crossGap={6}>
              <Badge>默认</Badge>
              <Badge tone="brand">秋季限定</Badge>
              <Badge tone="success" dot>已完成</Badge>
              <Badge tone="warning" dot>制作中</Badge>
              <Badge tone="danger" dot>超时</Badge>
              <Badge tone="info">外卖</Badge>
              <Badge tone="danger" solid>库存告急</Badge>
            </Row>
            <Label>Price · with original</Label>
            <Price value={32} was={36} size={28} />
            <Label>Avatar · Progress</Label>
            <Row gap={16} align="center">
              <Avatar initials="林" size={40} />
              <Avatar initials="JC" size={32} />
              <Column width="fill" gap={6} align="stretch">
                <ProgressBar value={0.68} />
                <ProgressBar value={0.3} tint={color.sage} track={color.sageSoft} />
              </Column>
            </Row>
          </Column>
        </Grid>
      </Section>

      <Section title="Icons" note={`${Object.keys(ICONS).length} Lucide outlines, drawn with <Path>`}>
        <Grid columns={14} rowGap={18} columnGap={8}>
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <Column key={name} gap={8} align="center">
              <Row width={44} height={44} align="center" justify="center" cornerRadius={radius.md} fill={color.crema}>
                <Icon name={name} size={22} tint={color.roast} />
              </Row>
              <Text width={70} maxLines={1} textAlign="center" fontSize={10} color={color.muted}>{name}</Text>
            </Column>
          ))}
        </Grid>
      </Section>
    </Column>
  );
}

/** A component can return a <Span>: it still lands inside the surrounding Text. */
function Accent({ children }: { children: string }) {
  return (
    <Span italic fontWeight={400} color={color.caramel}>
      {children}
    </Span>
  );
}
