-- CreateTable
CREATE TABLE "GeoJSONData" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoJSONData_pkey" PRIMARY KEY ("id")
);
