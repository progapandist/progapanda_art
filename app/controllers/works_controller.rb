class WorksController < ApplicationController
  before_action :authenticate, only: [:show, :index]

  def index
    # We always pick one work
    @pagy, works = pagy(Work.all, items: 1)
    @work = works.sole
  end

  def show
    @work = Work.find_by(slug: params[:slug]) || random_work

    current_user&.views&.<< @work.slug
    current_user&.views&.uniq!&.sort!
    if current_user.views.size > 2 && current_user.views.map(&:to_s).sort.join == Work.pluck(:slug).sort.join
      current_user&.views&.clear
    end

    puts "🙏🙏🙏🙏🙏 Views: #{current_user&.views}"
  end

  private

  def current_user
    Current.user
  end

  def authenticate
    user_repo = UserRepository.instance
    Current.user = user_repo.find(params[:i]) || user_repo.create(SecureRandom.hex(8))
  end

  def random_work
    if current_user
      without_seen_slugs = Work.excluding_slugs(current_user.views)
      current_user.views.clear if without_seen_slugs.empty?
      without_seen_slugs.first_random.presence || Work.first_random
    else
      Work.first_random.excluding_slugs(params[:ps])
    end
  end
end
