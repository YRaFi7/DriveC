import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DriverServicesPricingConfig, HourlyPricingConfig } from '@/types';
import { defaultDriverServicesPricingConfig, defaultHourlyPricingConfig } from '@/lib/store';

export async function GET() {
  try {
    const fullSetting = await prisma.systemSetting.findUnique({
      where: { key: 'driver_services_pricing' }
    });

    if (fullSetting && fullSetting.value) {
      const val = fullSetting.value as any;
      const merged: DriverServicesPricingConfig = {
        ...defaultDriverServicesPricingConfig,
        ...val,
        hourly: val.hourly || defaultHourlyPricingConfig,
        services: {
          ...defaultDriverServicesPricingConfig.services,
          ...(val.services || {})
        },
        categoryRates: {
          ...defaultDriverServicesPricingConfig.categoryRates,
          ...(val.categoryRates || {})
        }
      };
      return NextResponse.json({
        ...merged,
        // Backward-compatible properties for components reading packages directly
        packages: merged.hourly.packages,
        extraHourRate: merged.hourly.extraHourRate
      });
    }

    const hourlySetting = await prisma.systemSetting.findUnique({
      where: { key: 'hourly_pricing' }
    });

    const hourlyConf: HourlyPricingConfig = (hourlySetting && hourlySetting.value)
      ? (hourlySetting.value as unknown as HourlyPricingConfig)
      : defaultHourlyPricingConfig;

    const fullConfig: DriverServicesPricingConfig = {
      ...defaultDriverServicesPricingConfig,
      hourly: hourlyConf
    };

    return NextResponse.json({
      ...fullConfig,
      packages: hourlyConf.packages,
      extraHourRate: hourlyConf.extraHourRate
    });
  } catch (error) {
    console.warn('Could not fetch pricing from DB, returning defaults:', error);
    return NextResponse.json({
      ...defaultDriverServicesPricingConfig,
      packages: defaultHourlyPricingConfig.packages,
      extraHourRate: defaultHourlyPricingConfig.extraHourRate
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Fetch existing configuration to merge with
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key: 'driver_services_pricing' }
    });
    const current: DriverServicesPricingConfig = (existingSetting && existingSetting.value)
      ? (existingSetting.value as any)
      : defaultDriverServicesPricingConfig;

    let updatedHourly: HourlyPricingConfig = current.hourly || defaultHourlyPricingConfig;

    // If body contains packages or extraHourRate
    if (Array.isArray(body.packages) && body.packages.length > 0) {
      const cleanedPackages = body.packages.map((p: any) => ({
        hours: Number(p.hours) || 2,
        rate: Number(p.rate) || 300,
        label: p.label || `${p.hours} Hours`,
        kmIncluded: Number(p.kmIncluded ?? p.includedKm) || (p.hours * 10),
        includedKm: Number(p.includedKm ?? p.kmIncluded) || (p.hours * 10)
      })).sort((a: any, b: any) => a.hours - b.hours);

      updatedHourly = {
        packages: cleanedPackages,
        extraHourRate: Number(body.extraHourRate ?? body.hourly?.extraHourRate ?? current.hourly.extraHourRate) || 150
      };
    } else if (body.hourly && Array.isArray(body.hourly.packages)) {
      updatedHourly = {
        packages: body.hourly.packages,
        extraHourRate: Number(body.hourly.extraHourRate) || 150
      };
    }

    const updatedServices = {
      ...current.services,
      ...(body.services || {})
    };

    const updatedCategories = {
      ...current.categoryRates,
      ...(body.categoryRates || {})
    };

    const fullConfig: DriverServicesPricingConfig = {
      hourly: updatedHourly,
      services: updatedServices,
      categoryRates: updatedCategories,
      gstPercentage: Number(body.gstPercentage) || current.gstPercentage || 5,
      platformFee: Number(body.platformFee) || current.platformFee || 25
    };

    // Save full services config
    await prisma.systemSetting.upsert({
      where: { key: 'driver_services_pricing' },
      update: { value: fullConfig as any },
      create: { key: 'driver_services_pricing', value: fullConfig as any }
    });

    // Also sync hourly_pricing for backwards compatibility
    await prisma.systemSetting.upsert({
      where: { key: 'hourly_pricing' },
      update: { value: updatedHourly as any },
      create: { key: 'hourly_pricing', value: updatedHourly as any }
    });

    return NextResponse.json({
      success: true,
      config: fullConfig,
      packages: fullConfig.hourly.packages,
      extraHourRate: fullConfig.hourly.extraHourRate
    });
  } catch (error: any) {
    console.error('Failed to update pricing:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
