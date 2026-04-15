import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/api/chatClient", () => ({
  postChat: vi.fn(),
}));

import { _resetChatStoreForTests, useChatStore } from "@/store/chatStore";
import { Composer } from "./Composer";

beforeEach(() => {
  _resetChatStoreForTests();
  try {
    localStorage.removeItem("bazak.chat.v1");
  } catch {
    // ignore
  }
  act(() => {
    useChatStore.getState().startNewSession();
  });
});

describe("Composer", () => {
  it("submits on Enter by invoking sendMessage with the trimmed value", () => {
    const sendSpy = vi
      .spyOn(useChatStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);

    render(<Composer />);
    const textarea = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(sendSpy).toHaveBeenCalledWith("hello world");
    expect(textarea.value).toBe("");
  });

  it("Shift+Enter does NOT submit (default textarea newline behavior)", () => {
    const sendSpy = vi
      .spyOn(useChatStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);

    render(<Composer />);
    const textarea = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "line1" } });
    // Shift+Enter: our handler should not preventDefault, and should not submit.
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(sendSpy).not.toHaveBeenCalled();
    // Textarea value should not have been cleared.
    expect(textarea.value).toBe("line1");
  });

  it("empty/whitespace input does not call sendMessage", () => {
    const sendSpy = vi
      .spyOn(useChatStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);

    render(<Composer />);
    const textarea = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "    " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(sendSpy).not.toHaveBeenCalled();

    const button = screen.getByTestId("composer-action") as HTMLButtonElement;
    expect(button).toBeDisabled();
  });

  it("while isThinking: button shows 'Stop' and textarea is disabled", () => {
    const stopSpy = vi
      .spyOn(useChatStore.getState(), "stopGeneration")
      .mockImplementation(() => undefined);
    act(() => {
      useChatStore.setState({ isThinking: true });
    });

    render(<Composer />);

    const button = screen.getByTestId("composer-action");
    expect(button).toHaveTextContent("Stop");

    const textarea = screen.getByTestId("composer-textarea") as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();

    fireEvent.click(button);
    expect(stopSpy).toHaveBeenCalled();
  });

  it("second Stop click while still thinking does NOT call stopGeneration again", () => {
    // Install spy BEFORE first render — useSendMessage captures stopGeneration
    // via selector at render time.
    const stopSpy = vi
      .spyOn(useChatStore.getState(), "stopGeneration")
      .mockImplementation(() => undefined);
    act(() => {
      useChatStore.setState({ isThinking: true });
    });

    render(<Composer />);
    const button = screen.getByTestId("composer-action") as HTMLButtonElement;

    // First click: triggers abort + disables the button.
    fireEvent.click(button);
    expect(stopSpy).toHaveBeenCalledTimes(1);

    // After the first click we expect the button to present as disabled —
    // accept any of: native disabled, aria-disabled="true", or an opacity-50
    // class indicating visually-disabled state.
    const looksDisabled =
      button.disabled ||
      button.getAttribute("aria-disabled") === "true" ||
      button.className.includes("opacity-50");
    expect(looksDisabled).toBe(true);

    // Second click while isThinking is still true — must be a no-op.
    fireEvent.click(button);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
