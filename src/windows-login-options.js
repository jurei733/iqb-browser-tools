// The original dialog uses Int32.TryParse, leaving zero on invalid input.
export function windowsLoginInteger(value){
  const text=String(value??'').trim();
  if(!/^[+-]?\d+$/.test(text))return 0;
  const number=Number(text);
  return Number.isInteger(number)&&number>=-2147483648&&number<=2147483647?number:0;
}
