from __future__ import annotations

import uvicorn


if __name__ == "__main__":
    uvicorn.run("tourstar.app.domain.v1.inference.app:app", host="0.0.0.0", port=8011, reload=True)


