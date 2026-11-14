// Sample content shared by the Roastery screens.
import americano from "./assets/Americano.jpg";
import beans from "./assets/Beans.jpg";
import croissant from "./assets/Croissant.jpg";
import iced from "./assets/IcedLatte.jpg";
import latte from "./assets/Latte.jpg";
import pourOver from "./assets/PourOver.jpg";

export const images = { americano, beans, croissant, iced, latte, pourOver };

import type { ImageAsset } from "artboards";

export interface Product {
  id: string;
  name: string;
  en: string;
  desc: string;
  price: number;
  was?: number;
  image: ImageAsset;
  tag?: string;
}

export const products: Product[] = [
  { id: "osmanthus", name: "桂花燕麦拿铁", en: "Osmanthus Oat Latte", desc: "金桂糖浆 · 燕麦奶 · 双份浓缩", price: 32, was: 36, image: latte, tag: "秋季限定" },
  { id: "iced", name: "冰摇生椰拿铁", en: "Iced Coconut Latte", desc: "生椰乳 · 冷萃基底 · 少冰更香", price: 28, image: iced, tag: "人气" },
  { id: "americano", name: "美式", en: "Americano", desc: "埃塞俄比亚 + 巴西拼配，坚果与可可尾韵", price: 22, image: americano },
  { id: "pourover", name: "手冲 · 耶加雪菲", en: "Yirgacheffe Pour-over", desc: "水洗处理，茉莉花香与柑橘酸质", price: 38, image: pourOver, tag: "单一产地" },
  { id: "croissant", name: "黄油可颂", en: "Butter Croissant", desc: "法国 AOP 黄油，每日现烤", price: 18, image: croissant },
  { id: "beans", name: "耶加雪菲咖啡豆 250g", en: "Yirgacheffe Beans", desc: "浅烘 · 适合手冲与爱乐压", price: 98, image: beans },
];

export const byId = Object.fromEntries(products.map((p) => [p.id, p]));

export const yuan = (n: number) => `¥${n.toFixed(2)}`;
