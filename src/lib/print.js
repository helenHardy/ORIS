export function printHTML(html) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.position = 'fixed'
    frame.style.top = '0'
    frame.style.left = '-10000px'
    frame.style.width = '794px'
    frame.style.height = '1123px'
    frame.style.border = '0'
    frame.style.opacity = '0'
    frame.style.pointerEvents = 'none'
    document.body.appendChild(frame)

    const doc = frame.contentDocument || frame.contentWindow.document
    const win = frame.contentWindow

    const printAndClean = () => {
        try { win.focus() } catch (e) {}
        try {
            win.print()
        } catch (e) {
            try { window.print() } catch (e2) {}
        }
        setTimeout(() => {
            if (frame.parentNode) {
                frame.parentNode.removeChild(frame)
            }
        }, 1000)
    }

    doc.open()
    doc.write(html)
    doc.close()

    if (doc.readyState === 'complete') {
        printAndClean()
    } else {
        win.onload = printAndClean
    }
}