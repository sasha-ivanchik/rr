function getBusinessDate(offset: number): string {
  const date = new Date();

  let remaining = Math.abs(offset); // всегда считаем абсолютное значение

  while (remaining > 0) {
    date.setDate(date.getDate() - 1); // всегда идём назад
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1; // засчитываем только будние дни
    }
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
