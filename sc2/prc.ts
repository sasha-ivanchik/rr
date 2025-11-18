function getLastYearQuarters(): string[] {
  const now = new Date();
  let year = now.getFullYear();
  const month = now.getMonth(); // 0 - Jan, 11 - Dec

  // определяем текущий квартал
  let currentQuarter = Math.floor(month / 3) + 1;

  const quarters: string[] = [];

  for (let i = 0; i < 4; i++) {
    // Добавляем текущий квартал в массив
    quarters.push(`Q${currentQuarter} ${year}`);

    // Переходим к предыдущему кварталу
    currentQuarter--;
    if (currentQuarter === 0) {
      currentQuarter = 4;
      year--;
    }
  }

  return quarters;
}

console.log(getLastYearQuarters());
