"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

export async function createTodo(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const businessId = formData.get("businessId") as string;
  const dueDateStr = formData.get("dueDate") as string | null;
  const ownerId = (formData.get("ownerId") as string) || session.user.id;
  const meetingId = (formData.get("meetingId") as string) || null;
  const rockId = (formData.get("rockId") as string) || null;
  const milestoneId = (formData.get("milestoneId") as string) || null;
  const startDateStr = formData.get("startDate") as string | null;
  const endDateStr = formData.get("endDate") as string | null;

  if (!title || !businessId) throw new Error("Missing required fields");

  const dueDate = dueDateStr ? new Date(dueDateStr) : null;
  const startDate = startDateStr ? new Date(startDateStr + "T12:00:00") : null;
  const endDate = endDateStr ? new Date(endDateStr + "T12:00:00") : null;

  await prisma.todo.create({
    data: { title, businessId, ownerId, dueDate, meetingId, rockId, milestoneId, startDate, endDate },
  });

  const biz = await prisma.business.findUnique({ where: { id: businessId } });

  // Notify the assigned owner (skip if assigning to yourself)
  if (ownerId !== session.user.id) {
    const href = rockId && biz ? `/${biz.slug}/rocks/${rockId}` : "/my-todos";
    await notify({
      userId: ownerId,
      type: "todo-assigned",
      title: `New To-Do Assigned: ${title}`,
      body: `You've been assigned a new to-do: "${title}"${biz ? ` at ${biz.name}` : ""}.`,
      href,
    });
  }

  if (biz) {
    revalidatePath(`/${biz.slug}/todos`);
    if (rockId) revalidatePath(`/${biz.slug}/rocks/${rockId}`);
  }
  revalidatePath("/my-todos");
}

export async function toggleTodo(todoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({ where: { id: todoId }, data: { done: !todo.done } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function updateTodoOwner(todoId: string, newOwnerId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({ where: { id: todoId }, data: { ownerId: newOwnerId } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function updateTodoTitle(todoId: string, newTitle: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!newTitle.trim()) throw new Error("Title required");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({ where: { id: todoId }, data: { title: newTitle.trim() } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function deleteTodo(todoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.delete({ where: { id: todoId } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function killTodo(todoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({ where: { id: todoId }, data: { killed: true, done: false } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function reviveTodo(todoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({ where: { id: todoId }, data: { killed: false } });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function updateTodoDates(todoId: string, startDate: string | null, endDate: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({
    where: { id: todoId },
    data: {
      startDate: startDate ? new Date(startDate + "T12:00:00") : null,
      endDate: endDate ? new Date(endDate + "T12:00:00") : null,
    },
  });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}

export async function updateTodoMilestone(todoId: string, milestoneId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const todo = await prisma.todo.findUnique({ where: { id: todoId }, include: { business: true } });
  if (!todo) throw new Error("Todo not found");

  await prisma.todo.update({
    where: { id: todoId },
    data: { milestoneId },
  });

  revalidatePath(`/${todo.business.slug}/todos`);
  if (todo.rockId) revalidatePath(`/${todo.business.slug}/rocks/${todo.rockId}`);
  revalidatePath("/my-todos");
}
