import { afterEach, describe, expect, it } from "vitest";
import { getLang, startTranslator, translate } from "@/lib/i18n";

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; localStorage.clear(); document.body.replaceChildren(); });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("localization boundaries", () => {
  it("only accepts the supported stored language", () => {
    localStorage.setItem("ui-lang", "fr");
    expect(getLang()).toBe("zh");
    localStorage.setItem("ui-lang", "en");
    expect(getLang()).toBe("en");
  });
  it("keeps protected vocabulary and its attributes unchanged on insertion and update", async () => {
    localStorage.setItem("ui-lang", "en");
    stop = startTranslator();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-no-translate", "");
    const meaning = document.createElement("span");
    meaning.textContent = "能量";
    meaning.title = "经验";
    wrapper.append(meaning);
    document.body.append(wrapper);
    await settle();
    expect(meaning.textContent).toBe("能量");
    expect(meaning.title).toBe("经验");
    meaning.firstChild && (meaning.firstChild.nodeValue = "科学");
    await settle();
    expect(meaning.textContent).toBe("科学");
  });
  it("observes new UI text and attributes without replacing DOM nodes", async () => {
    localStorage.setItem("ui-lang", "en");
    stop = startTranslator();
    const element = document.createElement("span");
    element.textContent = "抽奖大厅";
    element.title = "播放发音";
    const node = element.firstChild;
    document.body.append(element);
    await settle();
    expect(element.firstChild).toBe(node);
    expect(element.textContent).not.toMatch(/[\u4e00-\u9fff]/);
    expect(element.title).not.toMatch(/[\u4e00-\u9fff]/);
    element.firstChild && (element.firstChild.nodeValue = "再来十连");
    await settle();
    expect(element.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  });
  it("retains dynamic quantities and is idempotent", () => {
    for (const amount of [1, 7, 10]) {
      const translated = translate(`已完成 ${amount} 抽，其余未能开奖，券未扣除`);
      expect(translated.match(/\d+/g)).toEqual([String(amount)]);
      expect(translated).not.toMatch(/[\u4e00-\u9fff]/);
      expect(translate(translated)).toBe(translated);
    }
  });
});
