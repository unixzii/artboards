import { Column, Ellipse, Frame, Path, Rect, Row, Text } from "artboards";

export default function Demo() {
  return (
    <Frame width={480} height={320} fill="#0f172a" clip>
      {/* Background colorful shapes & crisp vector curves crossing the glass edge */}
      <Ellipse x={28} y={24} width={150} height={150} fill="#6366f1" />
      <Ellipse x={270} y={130} width={160} height={160} fill="#ec4899" />
      <Ellipse x={185} y={18} width={110} height={110} fill="#06b6d4" />
      <Rect x={68} y={195} width={130} height={84} cornerRadius={18} fill="#f59e0b" />

      <Path
        x={0}
        y={96}
        width={480}
        height={140}
        viewBox="0 0 480 140"
        d="M 0 95 C 90 15, 175 135, 265 65 C 345 5, 410 115, 480 40"
        stroke="#38bdf8"
        strokeWidth={5}
        strokeCap="round"
      />
      <Path
        x={0}
        y={124}
        width={480}
        height={140}
        viewBox="0 0 480 140"
        d="M 0 45 C 110 130, 210 10, 310 85 C 385 140, 435 55, 480 90"
        stroke="#f472b6"
        strokeWidth={3.5}
        strokeCap="round"
      />

      <Text x={34} y={42} fontSize={44} fontWeight={800} color="#ffffff">
        FROSTED
      </Text>
      <Text x={244} y={232} fontSize={40} fontWeight={800} color="#ffffff">
        VECTOR
      </Text>

      {/* Frosted glass card */}
      <Column
        name="Glass Card"
        x={80}
        y={68}
        width={320}
        padding={22}
        gap={16}
        cornerRadius={22}
        backdropBlur={28}
        fill="rgba(15, 23, 42, 0.36)"
        stroke="rgba(255, 255, 255, 0.32)"
        strokeWidth={1.5}
        shadow={[
          { y: 4, blur: 10, color: "rgba(0, 0, 0, 0.22)" },
          { y: 20, blur: 40, spread: -4, color: "rgba(0, 0, 0, 0.45)" },
        ]}
      >
        <Row width="fill" align="center" justify="space-between">
          <Row gap={10} align="center">
            <Row
              width={34}
              height={34}
              align="center"
              justify="center"
              cornerRadius={10}
              fill="rgba(16, 185, 129, 0.24)"
              stroke="rgba(52, 211, 153, 0.45)"
            >
              <Path
                width={18}
                viewBox="0 0 24 24"
                d="M 20 6 L 9 17 L 4 12"
                stroke="#34d399"
                strokeWidth={2.5}
                strokeCap="round"
                strokeJoin="round"
              />
            </Row>
            <Column gap={2}>
              <Text fontSize={16} fontWeight={700} color="#ffffff">
                Glass & Vector
              </Text>
              <Text fontSize={12} color="#cbd5e1">
                backdropBlur + shadow + Path
              </Text>
            </Column>
          </Row>

          <Path
            width={20}
            viewBox="0 0 24 24"
            d="M 12 2 L 14.9 8.6 L 22 9.3 L 16.6 14 L 18.2 21 L 12 17.3 L 5.8 21 L 7.4 14 L 2 9.3 L 9.1 8.6 Z"
            fill="#fbbf24"
            shadow={{ y: 2, blur: 8, color: "rgba(251, 191, 36, 0.55)" }}
          />
        </Row>

        {/* Mini sparkline chart inside the glass card */}
        <Path
          width="fill"
          height={42}
          viewBox="0 0 276 42"
          d="M 2 34 L 46 24 L 92 30 L 138 12 L 184 20 L 230 6 L 274 14"
          stroke="#e2e8f0"
          strokeWidth={2.5}
          strokeCap="round"
          strokeJoin="round"
        />

        <Row width="fill" justify="space-between" align="center">
          <Text fontSize={12} color="#e2e8f0">
            Blur radius 28px
          </Text>
          <Text fontSize={12} fontWeight={600} color="#34d399">
            Active
          </Text>
        </Row>
      </Column>
    </Frame>
  );
}
