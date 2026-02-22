-- CreateTable
CREATE TABLE "reservations" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "use_date" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "guest_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "people_count" INTEGER NOT NULL,
    "user_type" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "extra_amount" INTEGER NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL,
    "deposit_date" TIMESTAMP(3) NOT NULL,
    "cancel_date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
