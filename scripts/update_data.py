from src.webscrapper import run_all_scrapers
from src.curator import main as run_curator


def main():
    print("Atualizando dados da GameTora...")
    run_all_scrapers()

    print("Gerando dataset curado...")
    run_curator()

    print("Update finalizado.")


if __name__ == "__main__":
    main()
