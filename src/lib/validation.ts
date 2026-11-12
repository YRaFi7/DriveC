/**
 * Validates that a mobile number contains exactly 10 digits.
 * Returns null when valid, or the required validation message when invalid.
 * Callers should check for empty input first to preserve existing required-field messages.
 */
export function validateMobileNumber(rawValue: string): string | null {
  const digits = rawValue.replace(/\D/g, '');
  if (digits.length < 10) {
    return 'Mobile number must contain exactly 10 digits.';
  }
  if (digits.length > 10) {
    return 'Mobile number cannot exceed 10 digits.';
  }
  return null;
}

/**
 * Checks whether a driver's transmission and fuel capabilities match a vehicle's transmission and fuel type.
 */
export function isDriverVehicleCompatible(
  driver: { transmissionCapabilities?: string[] | null; fuelCapabilities?: string[] | null },
  vehicle: { transmission?: string | null; fuelType?: string | null }
): boolean {
  const dTrans = (driver.transmissionCapabilities && driver.transmissionCapabilities.length > 0
    ? driver.transmissionCapabilities
    : ['manual', 'automatic']
  ).map(t => t.toLowerCase());
  const targetTrans = (vehicle.transmission || '').trim().toLowerCase();
  const transOk = !targetTrans || dTrans.includes(targetTrans);

  const dFuels = (driver.fuelCapabilities && driver.fuelCapabilities.length > 0
    ? driver.fuelCapabilities
    : ['petrol', 'diesel', 'ev']
  ).map(f => f.toLowerCase());
  const targetFuel = (vehicle.fuelType || '').trim().toLowerCase();
  const fuelOk = !targetFuel || dFuels.some(f => {
    if (targetFuel === 'ev' || targetFuel === 'electric') {
      return f === 'ev' || f === 'electric';
    }
    return f === targetFuel;
  });

  return transOk && fuelOk;
}
