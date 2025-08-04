async waitForAnimationsToEnd(timeout = 2000) {
    await this.page.evaluate((timeout) => {
      return new Promise<void>((resolve) => {
        const elements = Array.from(document.querySelectorAll('*'));
        let remaining = 0;
        const done = () => {
          remaining--;
          if (remaining <= 0) resolve();
        };
  
        elements.forEach(el => {
          const style = getComputedStyle(el);
          const hasTransition = style.transitionDuration !== '0s';
          const hasAnimation = style.animationName !== 'none' && style.animationIterationCount !== 'infinite';
  
          if (hasTransition || hasAnimation) {
            remaining++;
            el.addEventListener('transitionend', done, { once: true });
            el.addEventListener('animationend', done, { once: true });
          }
        });
  
        if (remaining === 0) {
          resolve();
        }
  
        // Safety net: timeout in case animation events never fire
        setTimeout(() => resolve(), timeout);
      });
    }, timeout);
  }
  