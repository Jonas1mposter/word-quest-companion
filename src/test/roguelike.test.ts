import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { rogueAction } from "@/lib/roguelike";
beforeEach(() => rpc.mockReset());
describe("冒险服务器协议", () => {
  it("只提交当前版本、题号和原答案，不提交生命或奖励", async () => {
    rpc.mockResolvedValue({ data: { state: { answered: 2 }, feedback: { correct: true, damage: 8 } }, error: null });
    const result = await rogueAction({ action: "answer", run: "run", version: 3, index: 1, choice: "苹果" });
    expect(rpc).toHaveBeenCalledWith("rogue_action", { p_action: "answer", p_run: "run", p_version: 3, p_index: 1, p_choice: "苹果" });
    expect(result.state?.answered).toBe(2);
  });
  it("空恢复状态不创建新游戏", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await rogueAction({ action: "resume" })).toEqual({ state: null });
    expect(rpc.mock.calls[0][1].p_action).toBe("resume");
  });
  it("服务端拒绝时不自动换答案或重启", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "仅能重试原答案" } });
    await expect(rogueAction({ action: "answer", choice: "苹果", index: 1 })).rejects.toThrow("仅能重试原答案");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});