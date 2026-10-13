// Reference Mock Data strictly aligned with Prisma Schemas and Active App Models

export const mockUsers = [
  { id: 'usr-admin', name: 'Super Admin', username: 'admin', role: 'SUPER_ADMIN' },
  { id: 'usr-tester', name: 'Tester', username: 'Tester_User', role: 'SALES' }
];

export const mockDepartments = [
  { id: 'dept-offc', name: 'Office & Sales', code: 'DEP-OFFC' },
  { id: 'dept-carp', name: 'Carpentry', code: 'DEP-CARP' },
  { id: 'dept-edge', name: 'Edge Banding', code: 'DEP-EDGE' },
  { id: 'dept-assm', name: 'Assembly', code: 'DEP-ASSM' },
];

export const mockEmployees = [
  { 
    id: 'emp-1', 
    employeeCode: 'HR-0001', 
    name: 'Rajesh Sharma', 
    phone: '+91 98765 43210', 
    personalEmail: 'rajesh.s@dfurn.in', 
    departmentId: 'dept-offc', 
    designation: 'Senior Sales Lead', 
    employmentType: 'Permanent', 
    payType: 'Monthly', 
    baseRate: 65000 
  },
  { 
    id: 'emp-2', 
    employeeCode: 'HR-0002', 
    name: 'Pooja Verma', 
    phone: '+91 98765 43211', 
    personalEmail: 'pooja.v@dfurn.in', 
    departmentId: 'dept-offc', 
    designation: 'Commercial Sales Specialist', 
    employmentType: 'Permanent', 
    payType: 'Monthly', 
    baseRate: 55000 
  },
  { 
    id: 'emp-3', 
    employeeCode: 'HR-0006', 
    name: 'Ramesh Kumar', 
    phone: '+91 98765 43215', 
    personalEmail: 'ramesh.k@dfurn.in', 
    departmentId: 'dept-carp', 
    designation: 'Master Carpenter', 
    employmentType: 'Permanent', 
    payType: 'Daily', 
    baseRate: 950 
  }
];

export const mockClients = [
  { 
    id: 'cl-1', 
    clientCode: 'DF_CL_000001', 
    name: 'Grand Modulars', 
    taxId: '24AAACH7409R1ZZ', 
    phones: ['+91 9998887771'], 
    emails: ['info@grand.com'], 
    clientType: 'BUSINESS', 
    createdAt: new Date().toISOString() 
  },
  { 
    id: 'cl-2', 
    clientCode: 'DF_CL_000002', 
    name: 'Rajesh Mehta', 
    taxId: '', 
    phones: ['+91 9876543210'], 
    emails: ['rajesh@example.com'], 
    clientType: 'INDIVIDUAL', 
    createdAt: new Date().toISOString() 
  }
];

export const mockEnquiries = [
  { 
    id: 'enq-1', 
    enquiryNumber: 'DF_ENQ_000001', 
    clientId: 'cl-1', 
    clientName: 'Grand Modulars', 
    stage: 'Qualified', 
    outcome: 'Open',
    salespersonId: 'emp-1',
    salespersonName: 'Rajesh Sharma',
    notes: 'Needs 50 executive workstations.', 
    items: [
      { 
        id: 'i1', 
        description: 'Executive Workstation', 
        quantity: 50, 
        unitPrice: 12000, 
        total: 600000,
        expectedDimensions: '1500x750x750mm',
        materialPreference: 'Pre-laminated Particle Board + 2mm Edge Band'
      }
    ], 
    createdAt: new Date().toISOString() 
  }
];

export const mockQuotations = [
  { 
    id: 'qt-1', 
    quotationNumber: 'DF_QT_000001', 
    clientId: 'cl-1', 
    clientName: 'Grand Modulars', 
    enquiryId: 'enq-1',
    status: 'PENDING_APPROVAL', 
    totalAmount: 600000.00,
    items: [
      { 
        id: 'qi-1', 
        description: 'Executive Workstation', 
        quantity: 50, 
        unitPrice: 12000.00, 
        total: 600000.00,
        expectedDimensions: '1500x750x750mm',
        materialPreference: 'Pre-laminated Particle Board + 2mm Edge Band'
      }
    ],
    createdAt: new Date().toISOString() 
  }
];
