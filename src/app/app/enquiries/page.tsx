import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSession } from '@/lib/auth';
import MobileEnquiriesClient from './MobileEnquiriesClient';

export const instant = false;


function MobileEnquiriesLoadingSkeleton() {
  return (
    <div className="space-y-3 p-1 animate-pulse">
      <div className="h-10 bg-gray-200/80 rounded-xl" />
      <div className="flex gap-2 overflow-x-hidden pt-1">
        <div className="h-7 w-14 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-16 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-20 bg-gray-200/80 rounded-full" />
        <div className="h-7 w-16 bg-gray-200/80 rounded-full" />
      </div>
      <div className="space-y-3 pt-2">
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
        <div className="h-28 bg-white rounded-2xl border border-gray-200/80 shadow-2xs" />
      </div>
    </div>
  );
}

async function MobileEnquiriesDataLoader() {
  await connection();
  const session = await getAuthenticatedSession();

  const where: any = {};
  if (session?.role === 'SALES') {
    where.OR = [
      ...(session.employeeId ? [{ salespersonId: session.employeeId }] : []),
      ...(session.userId ? [{ enteredById: session.userId }] : []),
    ];
  }

  const [rawEnquiries, categories, sourceCategories, employees, clients, lostReasons] =
    await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: {
          client: true,
          category: true,
          salesperson: true,
          items: true,
          quotations: {
            select: {
              id: true,
              quotationNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              versions: {
                select: {
                  id: true,
                  versionNo: true,
                  versionCode: true,
                  status: true,
                  grossTotal: true,
                  createdAt: true,
                },
                orderBy: { versionNo: 'desc' },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          communicationLogs: {
            select: { id: true, date: true, mode: true, stage: true, description: true, loggedByName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.sourceCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, name: true, employeeCode: true, designation: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          clientCode: true,
          clientType: true,
          businessMode: true,
          phones: true,
          phoneDetails: true,
          companyName: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.lostReason.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

  const enquiries = JSON.parse(JSON.stringify(rawEnquiries));

  return (
    <MobileEnquiriesClient
      initialEnquiries={enquiries}
      categories={categories}
      sourceCategories={sourceCategories}
      salespersons={employees}
      clients={clients}
      lostReasons={lostReasons}
      userRole={session?.role || 'USER'}
    />
  );
}

export default function MobileEnquiriesPage() {
  return (
    <Suspense fallback={<MobileEnquiriesLoadingSkeleton />}>
      <MobileEnquiriesDataLoader />
    </Suspense>
  );
}
