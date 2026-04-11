export default function formatPreviewDate(dateValue: string) {
  if (!dateValue) return "Aujourd’hui";

  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return dateValue;

  return `${day}/${month}/${year}`;
}