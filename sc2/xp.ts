const locator = page.locator('your_selector_here');

const xpath = await locator.evaluate(el => {
    let path = '';
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = el.previousSibling;
        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === el.nodeName) {
                index++;
            }
            sibling = sibling.previousSibling;
        }
        const tagName = el.nodeName.toLowerCase();
        const step = (index > 1) ? `${tagName}[${index}]` : tagName;
        path = `/${step}${path ? '/' + path : ''}`;
        el = el.parentNode as Element;
    }
    return path;
});

console.log(`XPath: ${xpath}`);