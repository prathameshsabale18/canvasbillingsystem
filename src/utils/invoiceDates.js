const isValidDateParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const getInvoiceDateKey = value => {
  if (!value) return '';

  const dateString = String(value).trim();
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, yearText, monthText, dayText] = isoMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    return isValidDateParts(year, month, day)
      ? dateString
      : '';
  }

  const dayFirstMatch = dateString.match(
    /^(\d{2})([/-])(\d{2})\2(\d{4})$/
  );

  if (dayFirstMatch) {
    const [, dayText, , monthText, yearText] = dayFirstMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!isValidDateParts(year, month, day)) return '';

    return `${yearText}-${monthText}-${dayText}`;
  }

  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime())
    ? ''
    : timestamp.toISOString().slice(0, 10);
};

export const formatInvoiceDate = value => {
  const dateKey = getInvoiceDateKey(value);

  if (!dateKey) return '';

  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
};

export const toStoredInvoiceDate = value =>
  formatInvoiceDate(value);

export const getTodayInvoiceDate = (date = new Date()) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1
  ).padStart(2, '0')}/${date.getFullYear()}`;