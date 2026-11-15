// Sample content shared by the Roastery screens.
import americano from "./assets/Americano.jpg";
import beans from "./assets/Beans.jpg";
import croissant from "./assets/Croissant.jpg";
import iced from "./assets/IcedLatte.jpg";
import latte from "./assets/Latte.jpg";
import pourOver from "./assets/PourOver.jpg";

export const images = { americano, beans, croissant, iced, latte, pourOver };

import type { ImageAsset } from "artboards";
import type { IconName } from "./icons.ts";

// ------------------------------------------------------------------ options

export interface Choice {
  label: string;
  icon?: IconName;
  /** Price change in yuan when picked. */
  delta?: number;
}

/** One row of the product sheet: a single choice out of several. */
export interface OptionSpec {
  title: string;
  note?: string;
  choices: Choice[];
  initial: string;
  /** Draw as a segmented control instead of chips. */
  segmented?: boolean;
}

const SIZE: OptionSpec = {
  title: "杯型",
  segmented: true,
  choices: [{ label: "中杯 12oz", delta: -3 }, { label: "大杯 16oz" }, { label: "超大杯 20oz", delta: 4 }],
  initial: "大杯 16oz",
};
const TEMP: OptionSpec = {
  title: "温度",
  choices: [{ label: "热", icon: "flame" }, { label: "冰", icon: "snowflake" }, { label: "少冰" }, { label: "去冰" }],
  initial: "热",
};
const TEMP_COLD: OptionSpec = { title: "温度", choices: [{ label: "冰", icon: "snowflake" }, { label: "少冰" }, { label: "去冰" }], initial: "少冰" };
const TEMP_POUR: OptionSpec = { title: "温度", choices: [{ label: "热", icon: "flame" }, { label: "冰", icon: "snowflake" }], initial: "热" };
const MILK: OptionSpec = {
  title: "奶基",
  note: "燕麦奶已含",
  choices: [{ label: "燕麦奶", icon: "leaf" }, { label: "全脂奶", icon: "milk" }, { label: "生椰乳", delta: 2 }],
  initial: "燕麦奶",
};
const SUGAR: OptionSpec = { title: "甜度", choices: [{ label: "标准" }, { label: "少甜" }, { label: "不另外加糖" }], initial: "少甜" };
const HEAT: OptionSpec = { title: "加热", choices: [{ label: "加热", icon: "flame" }, { label: "常温" }], initial: "加热" };
const GRIND: OptionSpec = { title: "研磨", note: "粉状建议两周内喝完", choices: [{ label: "咖啡豆", icon: "bean" }, { label: "手冲粉" }, { label: "意式粉" }], initial: "咖啡豆" };

// ------------------------------------------------------------------ products

export interface Product {
  id: string;
  name: string;
  en: string;
  desc: string;
  /** Longer copy for the product sheet. */
  story?: string;
  price: number;
  was?: number;
  image: ImageAsset;
  tag?: string;
  /** Cups sold today, shown on the product sheet. */
  sold?: number;
  /** Home category chips this product shows under (besides 推荐). */
  categories: string[];
  options: OptionSpec[];
}

export const products: Product[] = [
  {
    id: "osmanthus",
    name: "桂花燕麦拿铁",
    en: "Osmanthus Oat Latte",
    desc: "金桂糖浆 · 燕麦奶 · 双份浓缩",
    story: "自熬金桂糖浆搭配燕麦奶与双份浓缩，入口是桂花的清甜，尾韵带一点烘焙坚果香。",
    price: 32,
    was: 36,
    image: latte,
    tag: "秋季限定",
    sold: 128,
    categories: ["拿铁"],
    options: [SIZE, TEMP, MILK, SUGAR],
  },
  {
    id: "iced",
    name: "冰摇生椰拿铁",
    en: "Iced Coconut Latte",
    desc: "生椰乳 · 冷萃基底 · 少冰更香",
    story: "冷萃浓缩与现开生椰乳一起冰摇，椰香清爽，咖啡感干净不苦。",
    price: 28,
    image: iced,
    tag: "人气",
    sold: 96,
    categories: ["拿铁", "冷萃"],
    options: [SIZE, TEMP_COLD, SUGAR],
  },
  {
    id: "americano",
    name: "美式",
    en: "Americano",
    desc: "埃塞俄比亚 + 巴西拼配，坚果与可可尾韵",
    price: 22,
    image: americano,
    categories: ["美式"],
    options: [SIZE, TEMP],
  },
  {
    id: "pourover",
    name: "手冲 · 耶加雪菲",
    en: "Yirgacheffe Pour-over",
    desc: "水洗处理，茉莉花香与柑橘酸质",
    story: "单一产地水洗豆，咖啡师现场手冲约 4 分钟。茉莉花香明亮，放凉后柑橘酸质更清晰。",
    price: 38,
    image: pourOver,
    tag: "单一产地",
    categories: ["手冲"],
    options: [TEMP_POUR],
  },
  {
    id: "croissant",
    name: "黄油可颂",
    en: "Butter Croissant",
    desc: "法国 AOP 黄油，每日现烤",
    price: 18,
    image: croissant,
    categories: ["烘焙"],
    options: [HEAT],
  },
  {
    id: "beans",
    name: "耶加雪菲咖啡豆 250g",
    en: "Yirgacheffe Beans",
    desc: "浅烘 · 适合手冲与爱乐压",
    price: 98,
    image: beans,
    categories: ["咖啡豆"],
    options: [GRIND],
  },
];

export const byId = Object.fromEntries(products.map((p) => [p.id, p]));

export const yuan = (n: number) => `¥${n.toFixed(2)}`;

// ------------------------------------------------------------------ cart

/** Picked choice per option title. */
export type Picks = Record<string, string>;

export interface CartLine {
  product: Product;
  /** Short summary of the picks, e.g. "大杯 · 热 · 燕麦奶 · 少甜"; also identifies the line. */
  options: string;
  unit: number;
  qty: number;
}

export function initialPicks(p: Product): Picks {
  return Object.fromEntries(p.options.map((o) => [o.title, o.initial]));
}

export function unitPrice(p: Product, picks: Picks, base = p.price) {
  return p.options.reduce((sum, o) => sum + (o.choices.find((c) => c.label === picks[o.title])?.delta ?? 0), base);
}

/** "大杯 16oz" reads as "大杯" in summaries. */
export function summarize(p: Product, picks: Picks) {
  return p.options.map((o) => picks[o.title].split(" ")[0]).join(" · ");
}

export function lineFor(p: Product, picks: Picks = initialPicks(p), qty = 1): CartLine {
  return { product: p, options: summarize(p, picks), unit: unitPrice(p, picks), qty };
}

/** Adds `qty` of a line, merging with an identical one already in the cart. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const same = lines.find((l) => l.product.id === line.product.id && l.options === line.options);
  if (!same) return [...lines, line];
  return lines.map((l) => (l === same ? { ...l, qty: l.qty + line.qty } : l));
}

/** Sets a line's quantity; zero removes it. */
export function setQty(lines: CartLine[], line: CartLine, qty: number): CartLine[] {
  return qty <= 0 ? lines.filter((l) => l !== line) : lines.map((l) => (l === line ? { ...l, qty } : l));
}

export const PROMO = "秋季第二杯半价";

/** Every second osmanthus latte is half price. */
export function cartTotals(lines: CartLine[]) {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  const promoLines = lines.filter((l) => l.product.id === "osmanthus");
  const promoCups = promoLines.reduce((n, l) => n + l.qty, 0);
  const cheapest = Math.min(...promoLines.map((l) => l.unit));
  const discount = promoCups >= 2 ? Math.floor(promoCups / 2) * (cheapest / 2) : 0;
  return { count, subtotal, discount };
}

/** What the customer has picked before the screens start: the cart behind Home and Checkout. */
export const SAMPLE_CART: CartLine[] = [
  lineFor(byId.osmanthus, initialPicks(byId.osmanthus), 2),
  lineFor(byId.iced),
  lineFor(byId.croissant),
];

/** Home category chips. */
export const CATEGORIES: [string, IconName?][] = [["推荐"], ["拿铁", "coffee"], ["美式"], ["冷萃", "snowflake"], ["手冲"], ["烘焙", "croissant"], ["咖啡豆", "bean"]];
