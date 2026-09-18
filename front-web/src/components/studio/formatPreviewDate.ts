export default function formatPreviewDate(
  dateValue: string,
  fallback = "Aujourd’hui"
): string {
  if (!dateValue) {
    return fallback;
  }

  const parts = dateValue.split("-");

  if (parts.length !== 3) {
    return dateValue;
  }

  const [year, month, day] = parts;

  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  const isValidDate =
    parsedDate.getFullYear() === Number(year) &&
    parsedDate.getMonth() === Number(month) - 1 &&
    parsedDate.getDate() === Number(day);

  if (!isValidDate) {
    return dateValue;
  }

  return `${day}/${month}/${year}`;
}