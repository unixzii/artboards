// Source for the bitmaps in ./assets: drawn with artboards, exported with
//   artboards render examples/features/illustrations.jsx --frame Latte --scale 2 -o examples/features/assets/latte.png
import { Ellipse, Frame, Path, Rect } from "artboards";

export function Latte() {
  return (
    <Frame width={320} height={240} clip fill={{ type: "linear", angle: 160, stops: ["#f3e3cf", "#d9b48f"] }}>
      <Ellipse x={-60} y={150} width={260} height={160} fill="rgba(255,255,255,0.25)" />
      <Ellipse x={190} y={-50} width={180} height={180} fill="rgba(120,72,40,0.12)" />
      {/* saucer */}
      <Ellipse x={70} y={168} width={180} height={40} fill="#fffaf3" shadow={{ y: 8, blur: 18, color: "rgba(80,45,20,0.25)" }} />
      {/* cup */}
      <Path x={92} y={88} width={136} height={100} viewBox="0 0 136 100" d="M 0 0 L 136 0 C 132 64 108 100 68 100 C 28 100 4 64 0 0 Z" fill={{ type: "linear", angle: 90, stops: ["#ffffff", "#efe4d6"] }} />
      <Path x={214} y={102} width={40} height={50} viewBox="0 0 40 50" d="M 6 6 C 30 0 42 18 34 32 C 28 42 16 46 4 44" stroke="#efe4d6" strokeWidth={9} strokeCap="round" />
      {/* coffee + latte art */}
      <Ellipse x={92} y={78} width={136} height={24} fill={{ type: "radial", stops: ["#c58b5c", "#7a4a2a"] }} />
      <Path x={140} y={81} width={40} height={18} viewBox="0 0 40 18" d="M 20 17 C 6 10 4 2 12 1 C 16 0 19 3 20 6 C 21 3 24 0 28 1 C 36 2 34 10 20 17 Z" fill="#f6e7d3" />
      {/* steam */}
      <Path x={128} y={20} width={64} height={52} viewBox="0 0 64 52" d="M 14 50 C 2 38 24 30 12 16 M 34 50 C 22 36 46 28 32 10 M 54 50 C 44 40 62 32 52 22" stroke="rgba(255,255,255,0.8)" strokeWidth={4} strokeCap="round" />
      <Rect x={0} y={0} width={320} height={240} fill={{ type: "radial", center: [0.5, 0.45], radius: 0.75, stops: [{ color: "rgba(0,0,0,0)", position: 0.6 }, "rgba(60,30,10,0.18)"] }} />
    </Frame>
  );
}
