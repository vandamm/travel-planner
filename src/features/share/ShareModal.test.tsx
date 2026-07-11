import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RoomProvider } from "../../data/RoomProvider"
import { ShareModal } from "./ShareModal"

afterEach(() => vi.unstubAllGlobals())

function renderShareModal(onClose = vi.fn()) {
  return render(
    <RoomProvider workerUrl="" roomId="test-room" enableSync={false}>
      <ShareModal onClose={onClose} />
    </RoomProvider>,
  )
}

describe("ShareModal", () => {
  it("displays the trip URL", () => {
    renderShareModal()
    const input = screen.getByDisplayValue(/test-room/)
    expect(input).toBeInTheDocument()
  })

  it("copies URL to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup()
    const clipboardSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)

    renderShareModal()
    const copyButton = screen.getByRole("button", { name: /copy/i })
    await user.click(copyButton)

    expect(clipboardSpy).toHaveBeenCalled()
    clipboardSpy.mockRestore()
  })

  it("shows Done button and closes on click", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderShareModal(onClose)
    const doneButton = screen.getByRole("button", { name: /done/i })
    await user.click(doneButton)

    expect(onClose).toHaveBeenCalled()
  })

  it("displays collaborators list", () => {
    renderShareModal()
    expect(screen.getByText(/collaborators/i)).toBeInTheDocument()
  })
})
