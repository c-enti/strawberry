const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Calendar {
  id: string;
  year: number;
  selectedMonths: string[];
  events: Array<{ date: string; title: string }>;
  backgroundUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createCalendar(
  data: Omit<Calendar, "id" | "createdAt" | "updatedAt">
) {
  const response = await fetch(`${API_BASE_URL}/calendar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create calendar");
  }

  return response.json();
}

export async function getCalendars() {
  const response = await fetch(`${API_BASE_URL}/calendar`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch calendars");
  }

  return response.json();
}

export async function getCalendar(id: string) {
  const response = await fetch(`${API_BASE_URL}/calendar?id=${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch calendar");
  }

  return response.json();
}

export async function updateCalendar(
  id: string,
  data: Partial<Omit<Calendar, "id" | "createdAt" | "updatedAt">>
) {
  const response = await fetch(`${API_BASE_URL}/calendar/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update calendar");
  }

  return response.json();
}

export async function deleteCalendar(id: string) {
  const response = await fetch(`${API_BASE_URL}/calendar/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete calendar");
  }

  return true;
}
